import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    marginBottom: 10,
  },
  progressContainer: {
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#de423e',
  },
  modalBody: {
    flex: 1,
    padding: 15,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  
  // Step containers
  stepContainer: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  
  // Date selection
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateTextContainer: {
    marginLeft: 15,
  },
  dateLabel: {
    fontSize: 14,
    color: '#666',
  },
  dateValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  stayDurationContainer: {
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
  },
  stayDurationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0066cc',
  },
  
  // Room and guest selection
  roomInfoContainer: {
    backgroundColor: '#f9f9f9',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  roomInfoText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  roomCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  roomCountLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  roomCountControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomCountButton: {
    backgroundColor: '#de423e',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roomCountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginHorizontal: 15,
    minWidth: 30,
    textAlign: 'center',
  },
  guestTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  guestTypePicker: {
    flex: 1,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  guestTypeLabel: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    textAlign: 'center',
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  picker: {
    height: 120,
  },
  guestSummaryContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  guestSummaryText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  guestSummaryError: {
    color: '#de423e',
    marginTop: 5,
    textAlign: 'center',
  },
  
  // Guest information
  guestInfoNote: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  guestInfoCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#eee',
  },
  guestInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  guestInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  removeGuestButton: {
    padding: 5,
  },
  guestInfoField: {
    marginBottom: 12,
  },
  guestInfoLabel: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
  },
  guestInfoInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#de423e',
  },
  fieldErrorText: {
    color: '#de423e',
    fontSize: 12,
    marginTop: 5,
  },
  addGuestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#de423e',
    borderRadius: 8,
    marginTop: 5,
  },
  addGuestText: {
    color: '#de423e',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  
  // Payment method
  bookingSummary: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  bookingSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedPayment: {
    borderColor: '#de423e',
    backgroundColor: '#fff5f5',
  },
  paymentTextContainer: {
    marginLeft: 15,
  },
  paymentText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  selectedPaymentText: {
    color: '#de423e',
  },
  paymentDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 3,
  },
  
  // Buttons
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#666',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginRight: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 5,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#de423e',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 5,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    marginLeft: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginRight: 5,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  
  // Error messages
  errorText: {
    color: '#de423e',
    marginBottom: 10,
    fontSize: 14,
    textAlign: 'center',
    backgroundColor: '#fff5f5',
    padding: 8,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ffcccc',
  },
});