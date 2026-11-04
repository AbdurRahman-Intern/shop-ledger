// Global dialogs mounted once in the app shell. Any page can open them with
// useUiStore.getState().openModal('payment', { customerId }) etc.
import CustomerModal from './CustomerModal.jsx';
import CreditModal from './CreditModal.jsx';
import PaymentModal from './PaymentModal.jsx';
import ReceiptModal from './ReceiptModal.jsx';

export default function ModalsHost() {
  return (
    <>
      <CustomerModal />
      <CreditModal />
      <PaymentModal />
      <ReceiptModal />
    </>
  );
}
