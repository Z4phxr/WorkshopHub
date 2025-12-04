import React, { useEffect } from 'react';

// this toast shows a short message to the user,
// it fades out after a few seconds and can call onclose when it hides,
// colors depend on the type so it is easy to tell if it is info success or error
export default function Toast({ message, type = 'info', onClose }) {
    useEffect(() => {
        const t = setTimeout(() => onClose && onClose(), 4000);
        return () => clearTimeout(t);
    }, [onClose]);

    const bg = type === 'success' ? '#dcfce7' : type === 'error' ? '#fee2e2' : '#e0f2fe';
    const color = type === 'success' ? '#065f46' : type === 'error' ? '#991b1b' : '#075985';

    return (
        <div style={{
            position: 'fixed',
            right: 20,
            top: 20,
            background: bg,
            color,
            padding: '10px 14px',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            zIndex: 9999
        }}>
            {message}
        </div>
    );
}
