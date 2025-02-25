from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
import cv2
import smtplib
import numpy as np
import pandas as pd
import io
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
import json
import time
from threading import Lock
from PIL import Image, ImageDraw, ImageFont
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Progress tracking
progress_lock = Lock()
cancel_flag = False
progress_data = {
    'total': 0,
    'current': 0,
    'completed': 0,
    'failed': 0,
    'currentEmail': '',
    'currentName': '',
    'subject': '',
    'emailBody': '',
    'failedEmails': [],
    'previewFields': {}  # Add this new field
}

# Add font locations at the top level
font_locations = {
    'Arial': ['arial.ttf', '/usr/share/fonts/truetype/arial.ttf', 'C:/Windows/Fonts/arial.ttf'],
    'Times New Roman': ['times.ttf', '/usr/share/fonts/truetype/times.ttf', 'C:/Windows/Fonts/times.ttf'],
    'Courier New': ['cour.ttf', '/usr/share/fonts/truetype/cour.ttf', 'C:/Windows/Fonts/cour.ttf'],
    'Georgia': ['georgia.ttf', '/usr/share/fonts/truetype/georgia.ttf', 'C:/Windows/Fonts/georgia.ttf'],
    'Verdana': ['verdana.ttf', '/usr/share/fonts/truetype/verdana.ttf', 'C:/Windows/Fonts/verdana.ttf'],
    'Impact': ['impact.ttf', '/usr/share/fonts/truetype/impact.ttf', 'C:/Windows/Fonts/impact.ttf']
}

def update_progress(updates):
    global progress_data
    with progress_lock:
        progress_data.update(updates)

@app.route('/api/progress')
def progress():
    def generate():
        while True:
            with progress_lock:
                yield f"data: {json.dumps(progress_data)}\n\n"
            time.sleep(0.5)
    
    return Response(generate(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
    })

@app.route('/api/cancelSending', methods=['POST'])
def cancel_sending():
    global cancel_flag
    with progress_lock:
        cancel_flag = True
    return jsonify({"message": "Cancelling email sending"}), 200

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def generate_certificate(template_bytes, name, x_start, x_end, y, font_name, font_scale, color="#000000", show_preview_box=False):
    """Generate certificate with exact positioning and sizing"""
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(template_bytes))
        if image.mode != 'RGB':
            image = image.convert('RGB')

        working_image = image.copy()
        draw = ImageDraw.Draw(working_image)

        # Convert hex color to RGB
        rgb_color = hex_to_rgb(color) if isinstance(color, str) else color

        # Font size calculation
        font_size = int(font_scale * 15)
        
        # Try loading the specified font, fall back to system fonts
        try:
            font = None
            if font_name in font_locations:
                for font_path in font_locations[font_name]:
                    try:
                        font = ImageFont.truetype(font_path, font_size)
                        break
                    except:
                        continue
            
            if font is None:
                font = ImageFont.load_default()
        except:
            font = ImageFont.load_default()

        # Get text dimensions
        text = name.strip()
        bbox = draw.textbbox((0, 0), text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Calculate exact center position
        center_x = x_start + ((x_end - x_start) - text_width) / 2
        
        # Adjust y position to account for text height and baseline
        adjusted_y = y - (text_height)  # Center text vertically at the specified y coordinate

        # Draw preview box if requested
        if show_preview_box:
            draw.rectangle(
                [(x_start, y - font_scale * 12), (x_end, y + font_scale * 3)],
                outline=(0, 255, 0),
                width=2
            )
            
            # Draw center line
            draw.line(
                [(x_start + (x_end - x_start) / 2, y - font_scale * 12),
                 (x_start + (x_end - x_start) / 2, y + font_scale * 3)],
                fill=(0, 255, 0),
                width=2
            )

        # Draw text with custom color
        draw.text((center_x, adjusted_y), text, fill=rgb_color, font=font)

        # Convert and return
        img_byte_arr = io.BytesIO()
        working_image.save(img_byte_arr, format='JPEG', quality=95)
        return img_byte_arr.getvalue()

    except Exception as e:
        raise Exception(f"Certificate generation failed: {str(e)}")

@app.route('/api/sendCertificates', methods=['POST'])
def send_certificates():
    global cancel_flag
    server = None
    
    try:
        # Reset flags and progress
        cancel_flag = False
        
        # Get and validate form data
        sender_email = request.form.get('senderEmail')
        app_password = request.form.get('appPassword')
        subject = request.form.get('subject')
        body = request.form.get('body')
        
        logger.info(f"Attempting to send emails from: {sender_email}")
        
        if not all([sender_email, app_password, subject, body]):
            logger.error("Missing required fields")
            return jsonify({"error": "All fields are required"}), 400

        # Get and validate files
        excel_file = request.files.get('excelFile')
        template_file = request.files.get('templateFile')
        
        if not excel_file or not template_file:
            logger.error("Missing required files")
            return jsonify({"error": "Both Excel file and template are required"}), 400

        # Process Excel file
        try:
            df = pd.read_excel(excel_file)
            df['email'] = df['email'].str.strip().str.lower()
            
            # Validate email format
            def is_valid_email(email):
                return pd.notna(email) and isinstance(email, str) and '@' in email
            
            df['valid_email'] = df['email'].apply(is_valid_email)
            
            # Filter valid rows
            valid_rows = df[df['valid_email'] & df['name'].notna()]
            invalid_rows = df[~(df['valid_email'] & df['name'].notna())]
            
            # Initialize progress with actual counts
            failed_list = [(row['email'] if pd.notna(row['email']) else 'No Email', 
                          'Invalid email or missing name') 
                         for _, row in invalid_rows.iterrows()]
            
            with progress_lock:
                progress_data.clear()
                progress_data.update({
                    'total': len(valid_rows),
                    'current': 0,
                    'completed': 0,
                    'failed': len(failed_list),
                    'currentEmail': 'Starting...',
                    'currentName': '',
                    'subject': subject,
                    'emailBody': body,
                    'failedEmails': [f"{email} - {reason}" for email, reason in failed_list]
                })
            
            logger.info(f"Valid rows: {len(valid_rows)}, Invalid rows: {len(invalid_rows)}")
            
            # After processing the Excel file and before sending emails
            if len(valid_rows) > 0:
                # Get the first row for preview
                preview_row = valid_rows.iloc[0].to_dict()
                with progress_lock:
                    progress_data['previewFields'] = preview_row
            
        except Exception as e:
            logger.error(f"Excel processing error: {str(e)}")
            return jsonify({"error": f"Error processing Excel file: {str(e)}"}), 400

        # Attempt SMTP connection
        try:
            server = smtplib.SMTP("smtp.gmail.com", 587)
            server.starttls()
            server.login(sender_email, app_password)
        except Exception as e:
            logger.error(f"SMTP connection failed: {str(e)}")
            return jsonify({"error": f"Failed to connect to email server: {str(e)}"}), 401

        template_bytes = template_file.read()
        successful = []

        # Get text fields configuration
        text_fields = json.loads(request.form.get('textFields', '[]'))
        
        # Process each valid email
        for index, row in valid_rows.iterrows():
            if cancel_flag:
                break

            current_email = row['email']
            
            try:
                # Update current progress
                with progress_lock:
                    progress_data.update({
                        'current': len(successful) + len(failed_list),
                        'currentEmail': current_email,
                        'currentName': row['name'],
                        'previewFields': row.to_dict()  # Update preview data with current row
                    })

                # Create a copy of template for this certificate
                image = Image.open(io.BytesIO(template_bytes))
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                draw = ImageDraw.Draw(image)

                # Process each text field
                for field in text_fields:
                    # Get the value from Excel using headerName
                    header = field['headerName']
                    if header not in row:
                        logger.warning(f"Header {header} not found in Excel row")
                        continue

                    text = str(row[header])
                    x_start = int(field['xCoord'])
                    x_end = int(field['endXCoord'])
                    y = int(field['yCoord'])
                    font_name = field['font']
                    font_size = int(float(field['fontSize']) * 15)  # Scale factor for better readability
                    text_color = field['textColor']
                    rgb_color = hex_to_rgb(text_color)

                    logger.info(f"Rendering text '{text}' with font {font_name} size {font_size} color {text_color}")

                    # Load font for this field
                    try:
                        font = None
                        if font_name in font_locations:
                            for font_path in font_locations[font_name]:
                                try:
                                    font = ImageFont.truetype(font_path, font_size)
                                    break
                                except:
                                    continue
                        
                        if font is None:
                            logger.warning(f"Font {font_name} not found, using default")
                            font = ImageFont.load_default()

                        # Get text dimensions and center it
                        bbox = draw.textbbox((0, 0), text, font=font)
                        text_width = bbox[2] - bbox[0]
                        text_height = bbox[3] - bbox[1]
                        
                        text_x = x_start + ((x_end - x_start) - text_width) / 2
                        text_y = y - text_height
                        
                        # Draw text with specified color
                        draw.text((text_x, text_y), text, fill=rgb_color, font=font)
                        
                    except Exception as e:
                        logger.error(f"Error rendering text field: {str(e)}")
                        continue

                # Convert to bytes
                img_byte_arr = io.BytesIO()
                image.save(img_byte_arr, format='JPEG', quality=95)
                cert_bytes = img_byte_arr.getvalue()

                # Create and send email
                message = MIMEMultipart()
                message["From"] = sender_email
                message["To"] = current_email
                message["Subject"] = subject
                message.attach(MIMEText(body, "plain"))

                attachment = MIMEApplication(cert_bytes, Name=f"{row['name']}.jpg")
                attachment['Content-Disposition'] = f'attachment; filename="{row["name"]}.jpg"'
                message.attach(attachment)

                server.send_message(message)
                successful.append(current_email)
                
                # Update completion count
                with progress_lock:
                    progress_data['completed'] = len(successful)
                
                logger.info(f"Successfully sent email to: {current_email}")

            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to send email to {current_email}: {error_msg}")
                failed_list.append((current_email, error_msg))
                
                # Update failed count and list
                with progress_lock:
                    progress_data.update({
                        'failed': len(failed_list),
                        'failedEmails': [f"{email} - {reason}" for email, reason in failed_list]
                    })

        # Final status update
        with progress_lock:
            progress_data.update({
                'current': len(valid_rows),
                'completed': len(successful),
                'failed': len(failed_list),
                'currentEmail': 'Completed',
                'currentName': ''
            })

        return jsonify({
            "successful": len(successful),
            "failed": len(failed_list),
            "failed_details": failed_list,
            "message": "Process cancelled" if cancel_flag else "Process completed",
            "status": "cancelled" if cancel_flag else "completed"
        }), 200

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Global error: {error_msg}")
        return jsonify({"error": f"Error: {error_msg}"}), 500

    finally:
        if server:
            try:
                server.quit()
                logger.info("SMTP connection closed")
            except:
                logger.error("Error closing SMTP connection")

@app.route('/api/previewCertificate', methods=['POST'])
def preview_certificate():
    try:
        template_file = request.files.get('templateFile')
        if not template_file:
            return jsonify({"error": "Template file is required"}), 400
            
        template_bytes = template_file.read()
        text_fields = json.loads(request.form.get('textFields', '[]'))
        
        # Create a copy of template for preview
        image = Image.open(io.BytesIO(template_bytes))
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        draw = ImageDraw.Draw(image)

        # Get preview data from progress if available
        with progress_lock:
            preview_data = progress_data.get('previewFields', {})

        # Draw each text field
        for field in text_fields:
            try:
                # Extract field properties
                header_name = field.get('headerName', '')
                text = str(preview_data.get(header_name, field.get('previewText', 'Sample Text')))
                x_start = int(field.get('xCoord', 0))
                x_end = int(field.get('endXCoord', x_start + 200))
                y = int(field.get('yCoord', 0))
                font_name = field.get('font', 'Arial')
                font_size = int(float(field.get('fontSize', 3)) * 15)
                text_color = field.get('textColor', '#000000')
                rgb_color = hex_to_rgb(text_color)

                logger.info(f"Processing field: {text} with font {font_name} size {font_size}")

                # Load font
                font = None
                if font_name in font_locations:
                    for font_path in font_locations[font_name]:
                        try:
                            font = ImageFont.truetype(font_path, font_size)
                            logger.info(f"Loaded font from: {font_path}")
                            break
                        except Exception as e:
                            logger.warning(f"Failed to load font from {font_path}: {e}")
                            continue

                if font is None:
                    logger.warning(f"Using default font for {font_name}")
                    font = ImageFont.load_default()

                # Calculate text dimensions and position
                bbox = draw.textbbox((0, 0), text, font=font)
                text_width = bbox[2] - bbox[0]
                text_height = bbox[3] - bbox[1]
                
                text_x = x_start + ((x_end - x_start) - text_width) / 2
                text_y = y - text_height

                # Draw preview box
                box_height = font_size * 1.5
                draw.rectangle(
                    [(x_start, y - box_height), (x_end, y + box_height/2)],
                    outline=(0, 255, 0),
                    width=2
                )
                
                # Draw center line
                center_x = x_start + (x_end - x_start) / 2
                draw.line(
                    [(center_x, y - box_height), (center_x, y + box_height/2)],
                    fill=(0, 255, 0),
                    width=1
                )

                # Draw text
                draw.text((text_x, text_y), text, fill=rgb_color, font=font)
                logger.info(f"Successfully drew text: {text}")

            except Exception as e:
                logger.error(f"Error processing field: {e}")
                continue

        # Convert and return
        img_byte_arr = io.BytesIO()
        image.save(img_byte_arr, format='JPEG', quality=95)
        return Response(img_byte_arr.getvalue(), mimetype='image/jpeg')
        
    except Exception as e:
        logger.error(f"Preview generation failed: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
