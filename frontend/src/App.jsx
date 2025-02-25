import React from 'react';
import EmailForm from './components/EmailForm.jsx';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className="app-header">
        <h1>Certificate Generator & Email Sender</h1>
        <p className="app-description">
          Generate and send certificates in bulk with custom text positioning and email content
        </p>
      </div>

      <div className="features">
        <div className="feature-item">
          <h3>Excel Data Import</h3>
          <p>Upload your Excel file with recipient names and email addresses</p>
        </div>
        <div className="feature-item">
          <h3>Custom Certificates</h3>
          <p>Position names precisely on your certificate template</p>
        </div>
        <div className="feature-item">
          <h3>Bulk Sending</h3>
          <p>Send personalized certificates to multiple recipients at once</p>
        </div>
        <div className="feature-item">
          <h3>Real-time Progress</h3>
          <p>Monitor sending progress and preview certificates as they're being sent</p>
        </div>
      </div>

      <EmailForm />
    </div>
  );
}

export default App;
