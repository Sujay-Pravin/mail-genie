import React, { useState } from 'react';
import CertificatePreview from './CertificatePreview.jsx';

const EmailForm = () => {
  const [senderEmail, setSenderEmail] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewName, setPreviewName] = useState('Your Name');
  const [excelFile, setExcelFile] = useState(null);
  const [templateFile, setTemplateFile] = useState(null);
  const [font, setFont] = useState("Arial");
  const [fontSize, setFontSize] = useState(3);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [error, setError] = useState(null);
  const [sendingProgress, setSendingProgress] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [textColor, setTextColor] = useState("#000000");
  const [textFields, setTextFields] = useState([
    { 
      id: 1, 
      previewText: 'Your Name', 
      headerName: 'name', 
      xCoord: 1000, 
      endXCoord: 1200, 
      yCoord: 700,
      font: 'Arial',
      fontSize: 3,
      textColor: '#000000'
    }
  ]);

  const addTextField = () => {
    const newId = textFields.length + 1;
    setTextFields([...textFields, {
      id: newId,
      previewText: `Preview Text ${newId}`,
      headerName: '',
      xCoord: 1000,
      endXCoord: 1200,
      yCoord: 700 + (newId * 100),
      font: 'Arial',
      fontSize: 3,
      textColor: '#000000'
    }]);
  };

  const removeTextField = (id) => {
    setTextFields(textFields.filter(field => field.id !== id));
  };

  const updateTextField = (id, property, value) => {
    setTextFields(textFields.map(field => 
      field.id === id ? { ...field, [property]: value } : field
    ));
  };

  const handleError = (error) => {
    let userMessage = "";
    
    if (typeof error === 'string') {
      if (error.includes("535-5.7.8")) {
        userMessage = "Wrong password! Please make sure you're using an App Password from your Google Account settings, not your regular Gmail password.";
      } else if (error.includes("535")) {
        userMessage = "Login failed! Please check your email and App Password. Remember to use an App Password, not your regular Gmail password.";
      } else if (error.includes("certificate")) {
        userMessage = "Certificate generation failed! Please check your template image and text positioning.";
      } else if (error.includes("columns")) {
        userMessage = "Excel file format error! Your file must have columns named exactly 'name' and 'email'.";
      } else if (error.includes("SMTP")) {
        userMessage = "Email server connection failed. Please check your internet connection and try again.";
      } else {
        userMessage = error;
      }
    } else {
      userMessage = "An unexpected error occurred. Please try again.";
    }
    
    setError(userMessage);
    // Scroll to error message
    setTimeout(() => {
      const errorElement = document.querySelector('.error-message');
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    // Auto dismiss after 15 seconds for password errors, 8 seconds for others
    const timeout = userMessage.includes("password") ? 15000 : 8000;
    setTimeout(() => setError(null), timeout);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPreviewData({
      senderEmail,
      subject,
      body,        // Add body to previewData
      templateFile,
      textFields,  // Include all text fields in preview data
    });
    setShowConfirmation(true);

    // Scroll to confirmation modal
    setTimeout(() => {
      const modalElement = document.querySelector('.confirmation-content');
      if (modalElement) {
        modalElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleConfirmedSubmit = async () => {
    setError(null);
    setSuccessMessage(null);
    setSendingProgress({
      total: 0,
      current: 0,
      completed: 0,
      failed: 0,
      currentEmail: 'Connecting...',
      currentName: '',
      subject: subject,
      emailBody: body,
      failedEmails: []
    });

    const eventSource = new EventSource('http://localhost:5000/api/progress');
    
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setSendingProgress(prev => ({
        ...prev,
        ...data
      }));
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    try {
      const formData = new FormData();
      formData.append('senderEmail', senderEmail);
      formData.append('appPassword', appPassword);
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('textFields', JSON.stringify(textFields));
      formData.append('font', font);
      formData.append('fontSize', fontSize);
      formData.append('textColor', textColor);
      if (excelFile) {
        formData.append('excelFile', excelFile);
      }
      if (templateFile) {
        formData.append('templateFile', templateFile);
      }

      const response = await fetch('http://localhost:5000/api/sendCertificates', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.message === "Process cancelled") {
          setSuccessMessage(`Process cancelled. Sent ${data.successful} certificates.`);
        } else if (data.failed_details.length > 0) {
          setError(`Successfully sent ${data.successful} emails, but failed to send to: ${data.failed_details.map(f => f[0]).join(", ")}`);
        } else {
          setSuccessMessage(`Successfully sent ${data.successful} certificates!`);
        }
      } else {
        handleError(data.error);
      }
    } catch (error) {
      handleError(error.message);
    } finally {
      eventSource.close();
      setShowConfirmation(false);
      setSendingProgress(null);
      setIsCancelling(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch('http://localhost:5000/api/cancelSending', {
        method: 'POST'
      });
      if (!response.ok) {
        throw new Error('Failed to cancel');
      }
    } catch (error) {
      handleError('Failed to cancel the process');
    }
  };

  return (
    <div className="form-preview-wrapper">
      {error && (
        <div className="error-message">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <p>{error}</p>
            <button onClick={() => setError(null)} className="error-close">×</button>
          </div>
        </div>
      )}
      {successMessage && (
        <div className="success-message">
          <div className="success-content">
            <span className="success-icon">✅</span>
            <p>{successMessage}</p>
            <button onClick={() => setSuccessMessage(null)} className="success-close">×</button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="form-fields">
        <div className="form-grid">
          {/* Email Configuration Section */}
          <div className="form-section">
            <h3>Email Configuration</h3>
            <p className="section-desc">Configure your email settings</p>
            <div className="input-group">
              <label>Sender Email:</label>
              <input
                type="email"
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="your-email@example.com"
                required
              />
              <small>Use your Gmail address</small>
            </div>
            <div className="input-group">
              <label>App Password:</label>
              <input
                type="password"
                value={appPassword}
                onChange={(e) => setAppPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Certificate Setup Section */}
          <div className="form-section">
            <h3>Certificate Setup</h3>
            <p className="section-desc">Upload your data and template</p>
            <div className="input-group">
              <label>Excel File (xlsx):</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setExcelFile(e.target.files[0])}
                required
              />
            </div>
            <div className="input-group">
              <label>Certificate Template:</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setTemplateFile(e.target.files[0])}
                required
              />
            </div>
          </div>
        </div>

        {/* Email Content Section */}
        <div className="form-section">
          <h3>Email Content</h3>
          <p className="section-desc">Customize your email message</p>
          <div className="input-group">
            <label>Subject:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Body:</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows="4"
            />
          </div>
        </div>

        {/* Text Fields Section */}
        <div className="form-section">
          <div className="text-fields-header">
            <h3>Text Positioning</h3>
            <button 
              type="button" 
              onClick={addTextField}
              className="add-text-field-button"
            >
              + Add Text Field
            </button>
          </div>
          <p className="section-desc">Add and configure text placement from Excel headers</p>

          <div className="text-positioning-layout">
            <div className="text-fields-container">
              {textFields.map((field) => (
                <div key={field.id} className="text-field-group">
                  <div className="text-field-header">
                    <h4>Text Field {field.id}</h4>
                    {field.id !== 1 && (
                      <button
                        type="button"
                        onClick={() => removeTextField(field.id)}
                        className="remove-text-field-button"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="coordinate-inputs">
                    <div className="input-group">
                      <label>Excel Header:</label>
                      <input
                        type="text"
                        value={field.headerName}
                        onChange={(e) => updateTextField(field.id, 'headerName', e.target.value)}
                        placeholder="Excel column header"
                        required
                      />
                    </div>
                    <div className="input-group">
                      <label>Preview Text:</label>
                      <input
                        type="text"
                        value={field.previewText}
                        onChange={(e) => updateTextField(field.id, 'previewText', e.target.value)}
                        placeholder="Preview text"
                      />
                    </div>
                    <div className="input-group">
                      <label>Start X:</label>
                      <input
                        type="number"
                        value={field.xCoord}
                        onChange={(e) => updateTextField(field.id, 'xCoord', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="input-group">
                      <label>End X:</label>
                      <input
                        type="number"
                        value={field.endXCoord}
                        onChange={(e) => updateTextField(field.id, 'endXCoord', Number(e.target.value))}
                        required
                      />
                    </div>
                    <div className="input-group">
                      <label>Y Coordinate:</label>
                      <input
                        type="number"
                        value={field.yCoord}
                        onChange={(e) => updateTextField(field.id, 'yCoord', Number(e.target.value))}
                        required
                      />
                    </div>
                    {/* Font controls for each field */}
                    <div className="input-group">
                      <label>Font Style:</label>
                      <select 
                        value={field.font} 
                        onChange={(e) => updateTextField(field.id, 'font', e.target.value)}
                      >
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Impact">Impact</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Font Size:</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        step="0.1"
                        value={field.fontSize}
                        onChange={(e) => updateTextField(field.id, 'fontSize', parseFloat(e.target.value))}
                      />
                    </div>
                    <div className="input-group">
                      <label>Text Color:</label>
                      <input
                        type="color"
                        value={field.textColor}
                        onChange={(e) => updateTextField(field.id, 'textColor', e.target.value)}
                        className="color-picker"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="preview-container">
              <h4>Live Preview</h4>
              <CertificatePreview
                templateFile={templateFile}
                textFields={textFields}
              />
            </div>
          </div>
        </div>

        <button type="submit" className="submit-button">
          Generate & Send Certificates
        </button>
      </form>

      {showConfirmation && (
        <div className="confirmation-modal">
          <div className="confirmation-content">
            {sendingProgress ? (
              <div className="sending-progress-compact">
                <div className="progress-header">
                  <h2>Sending Certificates...</h2>
                  <div className="stats-bar">
                    <span>Total: {sendingProgress.total}</span>
                    <span>Completed: {sendingProgress.completed}</span>
                    <span>Failed: {sendingProgress.failed}</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${(sendingProgress.completed / sendingProgress.total) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="progress-content">
                  <div className="status-panel">
                    <div className="current-status">
                      <h4>Current Recipient</h4>
                      <p><strong>Name:</strong> {sendingProgress.currentName || 'N/A'}</p>
                      <p><strong>Email:</strong> {sendingProgress.currentEmail}</p>
                    </div>

                    <div className="email-preview-compact">
                      <h4>Email Details</h4>
                      <div className="preview-content">
                        <p><strong>From:</strong> {senderEmail}</p>
                        <p><strong>Subject:</strong> {subject}</p>
                        <div className="email-body">
                          <strong>Body:</strong>
                          <pre>{body}</pre>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handleCancel}
                      disabled={isCancelling}
                      className="cancel-sending-button"
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel Sending'}
                    </button>
                  </div>

                  <div className="preview-panel">
                    <h4>Certificate Preview</h4>
                    <div className="certificate-preview-section">
                      {sendingProgress.currentName && (
                        <CertificatePreview
                          templateFile={templateFile}
                          textFields={textFields.map(field => ({
                            ...field,
                            previewText: field.headerName === 'name' ? 
                              sendingProgress.currentName : 
                              field.previewText
                          }))}
                        />
                      )}
                    </div>
                  </div>

                  <div className="info-panel">
                    <h4>Failed Emails</h4>
                    <div className="failed-list-compact">
                      {sendingProgress.failedEmails.length > 0 ? (
                        <div className="scroll-content">
                          {sendingProgress.failedEmails.map((email, index) => (
                            <div key={index} className="failed-item">{email}</div>
                          ))}
                        </div>
                      ) : (
                        <p>No failed emails yet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h2>Confirm Email Send</h2>
                <p>Are you sure you want to send certificates to all recipients?</p>
                
                <div className="confirmation-details">
                  <p><strong>From:</strong> {previewData.senderEmail}</p>
                  <p><strong>Subject:</strong> {previewData.subject}</p>
                  <div className="email-body-preview">
                    <strong>Email Body:</strong>
                    <pre>{previewData.body}</pre>
                  </div>
                </div>

                <div className="certificate-preview-container">
                  <h3>Certificate Preview</h3>
                  <div className="confirmation-preview">
                    <CertificatePreview
                      templateFile={previewData.templateFile}
                      textFields={previewData.textFields}
                    />
                  </div>
                </div>

                <div className="confirmation-actions">
                  <button onClick={handleConfirmedSubmit} className="confirm-button">
                    Yes, Send Emails
                  </button>
                  <button onClick={() => setShowConfirmation(false)} className="cancel-button">
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailForm;
