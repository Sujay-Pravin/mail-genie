import React, { useState, useEffect } from 'react';

const CertificatePreview = ({ 
    templateFile,
    textFields,
    fontSize,
    font,
    textColor
}) => {
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
        const generatePreview = async () => {
            if (!templateFile) return;

            try {
                const formData = new FormData();
                formData.append('templateFile', templateFile);
                formData.append('textFields', JSON.stringify(textFields));  // Pass all fields with their styles

                const response = await fetch('http://localhost:5000/api/previewCertificate', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    throw new Error('Failed to generate preview');
                }

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);

            } catch (error) {
                console.error('Preview generation failed:', error);
            }
        };

        generatePreview();

        // Cleanup
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [templateFile, textFields, fontSize, font, textColor]);

    if (!previewUrl) {
        return (
            <div className="preview-placeholder">
                <p>Upload a template to see preview</p>
            </div>
        );
    }

    return (
        <img 
            src={previewUrl} 
            alt="Certificate Preview" 
            className="preview-image"
        />
    );
};

export default CertificatePreview;
