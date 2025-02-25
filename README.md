# Mail Genie

A full-stack application for generating and sending personalized certificates via email. Built with React (frontend) and Flask (backend).

## Features

- Upload certificate template images
- Import recipient data from Excel files
- Customize certificate text positioning and styling
- Real-time certificate preview
- Bulk email sending with progress tracking
- Error handling and retry capabilities
- Support for Gmail SMTP
- Live progress monitoring
- Cancellable sending process

## Prerequisites

- Node.js (v14 or higher)
- Python (v3.7 or higher)
- Gmail account with App Password enabled

### Setting up Gmail App Password

1. Go to your Google Account settings
2. Navigate to Security
3. Enable 2-Step Verification if not already enabled
4. Under "Signing in to Google," select App passwords
5. Generate a new app password for "Mail"
6. Save this password for use in the application

## Installation

### Backend Setup

1. Navigate to the backend directory:

```bash
cd backend
```

2. Create a virtual environment:

```bash
python -m venv venv
```

3. Activate the virtual environment:

- Windows:

```bash
venv\Scripts\activate
```

- Unix/macOS:

```bash
source venv/bin/activate
```

4. Install dependencies:

```bash
pip install -r requirements.txt
```

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

## Running the Application

1. Start the backend server:

```bash
cd backend
python app.py
```

The backend will run on http://localhost:5000

2. Start the frontend development server:

```bash
cd frontend
npm start
```

The frontend will run on http://localhost:3000

## Deployment

### Backend Deployment

1. Create a `.env` file in the backend directory:

```
FLASK_APP=app.py
FLASK_ENV=production
```

2. Install Gunicorn:

```bash
pip install gunicorn
```

3. Start the backend:

```bash
gunicorn -b 0.0.0.0:5000 app:app
```

### Frontend Deployment

1. Build the production frontend:

```bash
cd frontend
npm run build
```

2. The build folder can be served using any static file server.

### GitHub Deployment

1. Create a new repository on GitHub named "mail-genie"

2. Initialize and push the code:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/mail-genie.git
git push -u origin main
```

3. Configure GitHub repository settings:
   - Enable GitHub Pages for frontend deployment
   - Set up environment secrets for sensitive data
   - Configure workflow permissions

## Usage Guide

1. **Excel File Format**

   - Required columns:
     - 'name': Used for certificate text
     - 'email': Must be valid email addresses
   - No empty cells in required columns
   - File format: .xlsx

2. **Certificate Template Requirements**

   - Format: JPG, PNG
   - Recommended resolution: 1920x1080 or higher
   - Maximum file size: 10MB
   - Clear area for text placement

3. **Text Customization**

   - Font options: Arial, Times New Roman, Georgia, etc.
   - Size range: 1-10 (multiplied internally for optimal display)
   - Color picker for text color
   - Live preview with adjustment guides

4. **Email Settings**

   - Gmail accounts only
   - Requires App Password
   - HTML formatting not supported in email body
   - Attachments sent as JPEG

5. **Process Monitoring**
   - Real-time progress tracking
   - Failed email logging
   - Cancellation support
   - Preview of current certificate

## Troubleshooting

Common issues and solutions:

1. **Login Failed**

   - Ensure you're using an App Password, not your regular Gmail password
   - Check if 2-Step Verification is enabled

2. **Excel File Errors**

   - Verify column names are exactly 'name' and 'email'
   - Check for empty or invalid rows

3. **Certificate Generation Issues**
   - Ensure template image is not corrupted
   - Check if coordinates are within image bounds
   - Verify font availability on your system

## Security Notes

- Never share your App Password
- The application doesn't store any credentials
- All processing is done locally
- Files are processed in memory and not saved to disk

## Technical Details

- Frontend: React.js with modern hooks
- Backend: Flask with Python 3
- Image Processing: PIL (Python Imaging Library)
- Email: SMTP with TLS
- Data Processing: Pandas for Excel handling

## Recent Updates

- Added color picker for text customization
- Improved text positioning preview
- Enhanced error messages
- Added support for multiple text fields
- Real-time certificate preview

## License

MIT License - Feel free to use and modify for your needs.
