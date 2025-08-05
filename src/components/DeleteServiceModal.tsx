import { useState } from 'react'

interface DeleteServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  serviceTitle: string
  isLoading?: boolean
}

export function DeleteServiceModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  serviceTitle, 
  isLoading = false 
}: DeleteServiceModalProps) {
  const [confirmationText, setConfirmationText] = useState('')
  const isConfirmed = confirmationText === serviceTitle

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm()
    }
  }

  const handleClose = () => {
    setConfirmationText('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Delete Service</h3>
          <button onClick={handleClose} className="modal-close">
            ×
          </button>
        </div>
        
        <div className="modal-body">
          <div className="warning-message">
            <p>
              <strong>Warning:</strong> This action cannot be undone. Deleting this service will also remove:
            </p>
            <ul>
              <li>All songs assigned to this service</li>
              <li>Service notes and arrangements</li>
              <li>Service history and data</li>
            </ul>
            <p>
              <strong>Note:</strong> The songs themselves will not be deleted from your song library.
            </p>
          </div>
          
          <div className="confirmation-section">
            <p>
              To confirm deletion, please type the service name exactly as shown:
            </p>
            <p className="service-name-to-confirm">
              <strong>"{serviceTitle}"</strong>
            </p>
            <input
              type="text"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Type the service name to confirm"
              className="confirmation-input"
              disabled={isLoading}
            />
          </div>
        </div>
        
        <div className="modal-actions">
          <button
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
            className="btn btn-danger"
          >
            {isLoading ? 'Deleting...' : 'Delete Service'}
          </button>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
} 