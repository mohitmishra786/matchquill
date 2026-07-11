/**
 * Lazy-load jspdf only when the user exports a PDF.
 * Keeps the main client bundle smaller (issue: large PDF generation bundle).
 */

export async function loadJsPdf(): Promise<typeof import('jspdf')> {
  return import('jspdf');
}

export async function loadJsPdfAutoTable(): Promise<void> {
  await import('jspdf-autotable');
}
