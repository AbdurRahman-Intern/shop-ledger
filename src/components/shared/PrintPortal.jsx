// PRINT PORTAL — renders a document (receipt / statement) into #print-portal, outside the app
// shell. While mounted, a body class makes the print stylesheet hide the whole app and show only
// this document, so window.print() produces a clean page with no sidebar or buttons.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function PrintPortal({ children }) {
  useEffect(() => {
    document.body.classList.add('has-print-doc');
    return () => document.body.classList.remove('has-print-doc');
  }, []);
  const target = document.getElementById('print-portal');
  return target ? createPortal(children, target) : null;
}
