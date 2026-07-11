/**
 * Export Utilities
 * Provides data export functionality for JSON, PDF, and Word formats
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// ============================================================================
// Types
// ============================================================================

export type ExportFormat = 'json' | 'pdf' | 'word';

export interface ExportOptions {
    filename?: string;
    title?: string;
    includeMetadata?: boolean;
}

export interface ExportData {
    [key: string]: unknown;
}

// ============================================================================
// JSON Export
// ============================================================================

/**
 * Export data as JSON file
 */
export function exportToJSON(data: ExportData, options: ExportOptions = {}): void {
    const { filename = 'export.json', includeMetadata = true } = options;

    const exportPayload = includeMetadata
        ? {
              exportedAt: new Date().toISOString(),
              version: '1.0',
              data,
          }
        : data;

    const jsonString = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    downloadBlob(blob, filename);
}

/**
 * Export array data as CSV file
 */
export function exportToCSV(
    data: Record<string, unknown>[],
    options: ExportOptions & { headers?: string[] } = {}
): void {
    const { filename = 'export.csv', headers } = options;

    if (data.length === 0) {
        throw new Error('No data to export');
    }

    // Get headers from first item or provided headers
    const csvHeaders = headers || Object.keys(data[0]);

    // Create CSV content
    const csvRows: string[] = [];

    // Add header row
    csvRows.push(csvHeaders.join(','));

    // Add data rows
    for (const item of data) {
        const values = csvHeaders.map((header) => {
            const value = item[header];
            // Escape values containing commas or quotes
            const stringValue = String(value ?? '');
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        });
        csvRows.push(values.join(','));
    }

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, filename);
}

// ============================================================================
// PDF Export
// ============================================================================

/**
 * Export data as PDF file
 */
export function exportToPDF(
    data: ExportData | ExportData[],
    options: ExportOptions & {
        orientation?: 'portrait' | 'landscape';
        pageSize?: 'a4' | 'letter';
    } = {}
): void {
    const {
        filename = 'export.pdf',
        title = 'Export',
        orientation = 'portrait',
        pageSize = 'a4',
    } = options;

    const doc = new jsPDF({
        orientation,
        unit: 'mm',
        format: pageSize,
    });

    // Add title
    doc.setFontSize(20);
    doc.text(title, 20, 20);

    // Add timestamp
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 30);

    // Convert data to table format
    const dataArray = Array.isArray(data) ? data : [data];

    if (dataArray.length > 0) {
        const headers = Object.keys(dataArray[0]);
        const rows = dataArray.map((item) =>
            headers.map((header) => String(item[header] ?? ''))
        );

        (doc as jsPDF & { autoTable: (options: Record<string, unknown>) => void }).autoTable({
            head: [headers],
            body: rows,
            startY: 40,
            theme: 'grid',
            headStyles: {
                fillColor: [79, 70, 229],
                textColor: 255,
                fontStyle: 'bold',
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245],
            },
        });
    }

    doc.save(filename);
}

// ============================================================================
// Word Export
// ============================================================================

/**
 * Export data as Word document (HTML-based)
 */
export function exportToWord(
    data: ExportData | ExportData[],
    options: ExportOptions = {}
): void {
    const { filename = 'export.doc', title = 'Export' } = options;

    const dataArray = Array.isArray(data) ? data : [data];

    // Generate HTML content
    let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>${title}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { color: #333; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #4f46e5; color: white; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .timestamp { color: #666; font-size: 12px; margin-top: 10px; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
    `;

    if (dataArray.length > 0) {
        const headers = Object.keys(dataArray[0]);

        htmlContent += '<table>';
        htmlContent += '<thead><tr>';
        for (const header of headers) {
            htmlContent += `<th>${escapeHtml(header)}</th>`;
        }
        htmlContent += '</tr></thead>';

        htmlContent += '<tbody>';
        for (const item of dataArray) {
            htmlContent += '<tr>';
            for (const header of headers) {
                const value = item[header];
                htmlContent += `<td>${escapeHtml(String(value ?? ''))}</td>`;
            }
            htmlContent += '</tr>';
        }
        htmlContent += '</tbody></table>';
    } else {
        htmlContent += '<p>No data available</p>';
    }

    htmlContent += '</body></html>';

    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword',
    });
    downloadBlob(blob, filename);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reusable hidden download anchor — avoids creating/destroying DOM nodes
 * on every download (reduces layout thrashing).
 */
let sharedDownloadAnchor: HTMLAnchorElement | null = null;

function getDownloadAnchor(): HTMLAnchorElement {
    if (typeof document === 'undefined') {
        throw new Error('downloadBlob requires a browser environment');
    }
    if (!sharedDownloadAnchor) {
        sharedDownloadAnchor = document.createElement('a');
        sharedDownloadAnchor.setAttribute('aria-hidden', 'true');
        sharedDownloadAnchor.style.display = 'none';
        document.body.appendChild(sharedDownloadAnchor);
    }
    return sharedDownloadAnchor;
}

/**
 * Download a blob as a file using a single reusable anchor element.
 * Avoids create/append/remove thrashing on every export call.
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = getDownloadAnchor();
    // Revoke previous blob URL if still attached
    if (link.href && link.href.startsWith('blob:')) {
        try {
            URL.revokeObjectURL(link.href);
        } catch {
            /* ignore */
        }
    }
    link.href = url;
    link.download = filename;
    link.click();
    // Delay revoke so the browser can start the download
    window.setTimeout(() => {
        URL.revokeObjectURL(url);
        if (sharedDownloadAnchor?.getAttribute('href') === url) {
            sharedDownloadAnchor.removeAttribute('href');
            sharedDownloadAnchor.removeAttribute('download');
        }
    }, 1000);
}

/**
 * Escape HTML special characters without touching the DOM
 */
export function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Export data in the specified format
 */
export function exportData(
    data: ExportData | ExportData[],
    format: ExportFormat,
    options: ExportOptions = {}
): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const defaultFilename = `export-${timestamp}.${format === 'word' ? 'doc' : format}`;
    const mergedOptions = { filename: defaultFilename, ...options };

    switch (format) {
        case 'json':
            exportToJSON(data as ExportData, mergedOptions);
            break;
        case 'pdf':
            exportToPDF(data, mergedOptions);
            break;
        case 'word':
            exportToWord(data, mergedOptions);
            break;
        default:
            throw new Error(`Unsupported export format: ${format}`);
    }
}

// ============================================================================
// Resume Profile Export
// ============================================================================

export interface ResumeProfile {
    name?: string;
    email?: string;
    experiences?: Array<{
        company: string;
        title: string;
        startDate: string;
        endDate?: string;
        description?: string;
    }>;
    educations?: Array<{
        institution: string;
        degree: string;
        field?: string;
        startDate: string;
        endDate?: string;
    }>;
    skills?: Array<{
        name: string;
        category?: string;
        proficiency?: number;
    }>;
    projects?: Array<{
        name: string;
        description?: string;
        technologies?: string[];
    }>;
}

/**
 * Export resume profile to JSON
 */
export function exportResumeToJSON(profile: ResumeProfile, filename?: string): void {
    exportToJSON(profile as ExportData, {
        filename: filename || 'resume.json',
        title: `${profile.name || 'Resume'} - JSON Export`,
    });
}

/**
 * Export resume profile to PDF
 */
export function exportResumeToPDF(profile: ResumeProfile, filename?: string): void {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(24);
    doc.text(profile.name || 'Resume', 20, 20);

    let yPos = 30;

    // Contact info
    if (profile.email) {
        doc.setFontSize(12);
        doc.text(profile.email, 20, yPos);
        yPos += 10;
    }

    // Experience section
    if (profile.experiences && profile.experiences.length > 0) {
        doc.setFontSize(16);
        doc.text('Experience', 20, yPos);
        yPos += 10;

        for (const exp of profile.experiences) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`${exp.title} at ${exp.company}`, 20, yPos);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const dateRange = `${exp.startDate} - ${exp.endDate || 'Present'}`;
            doc.text(dateRange, 20, yPos);
            yPos += 6;

            if (exp.description) {
                const splitDescription = doc.splitTextToSize(exp.description, 170);
                doc.text(splitDescription, 20, yPos);
                yPos += splitDescription.length * 5 + 5;
            }

            yPos += 5;

            // Add new page if needed
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
        }
    }

    // Education section
    if (profile.educations && profile.educations.length > 0) {
        doc.setFontSize(16);
        doc.text('Education', 20, yPos);
        yPos += 10;

        for (const edu of profile.educations) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text(`${edu.degree} - ${edu.institution}`, 20, yPos);
            yPos += 6;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            const dateRange = `${edu.startDate} - ${edu.endDate || 'Present'}`;
            doc.text(dateRange, 20, yPos);
            yPos += 10;

            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
        }
    }

    // Skills section
    if (profile.skills && profile.skills.length > 0) {
        doc.setFontSize(16);
        doc.text('Skills', 20, yPos);
        yPos += 10;

        doc.setFontSize(10);
        const skillsText = profile.skills.map((s) => s.name).join(', ');
        const splitSkills = doc.splitTextToSize(skillsText, 170);
        doc.text(splitSkills, 20, yPos);
    }

    doc.save(filename || 'resume.pdf');
}

/**
 * Export resume profile to Word
 */
export function exportResumeToWord(profile: ResumeProfile, filename?: string): void {
    let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' 
              xmlns:w='urn:schemas-microsoft-com:office:word' 
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>${profile.name || 'Resume'}</title>
            <style>
                body { font-family: 'Calibri', sans-serif; margin: 40px; }
                h1 { color: #2c3e50; font-size: 28px; margin-bottom: 5px; }
                h2 { color: #34495e; font-size: 18px; margin-top: 25px; margin-bottom: 10px; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
                .contact { color: #7f8c8d; font-size: 12px; margin-bottom: 20px; }
                .experience-item, .education-item { margin-bottom: 15px; }
                .title { font-weight: bold; font-size: 14px; }
                .company { font-weight: bold; color: #2980b9; }
                .date { color: #7f8c8d; font-size: 11px; font-style: italic; }
                .description { font-size: 12px; margin-top: 5px; }
                .skills { font-size: 12px; }
            </style>
        </head>
        <body>
            <h1>${profile.name || 'Resume'}</h1>
            ${profile.email ? `<p class="contact">${profile.email}</p>` : ''}
    `;

    // Experience
    if (profile.experiences && profile.experiences.length > 0) {
        htmlContent += '<h2>Experience</h2>';
        for (const exp of profile.experiences) {
            htmlContent += `
                <div class="experience-item">
                    <div class="title">${escapeHtml(exp.title)} <span class="company">at ${escapeHtml(exp.company)}</span></div>
                    <div class="date">${exp.startDate} - ${exp.endDate || 'Present'}</div>
                    ${exp.description ? `<div class="description">${escapeHtml(exp.description)}</div>` : ''}
                </div>
            `;
        }
    }

    // Education
    if (profile.educations && profile.educations.length > 0) {
        htmlContent += '<h2>Education</h2>';
        for (const edu of profile.educations) {
            htmlContent += `
                <div class="education-item">
                    <div class="title">${escapeHtml(edu.degree)} - ${escapeHtml(edu.institution)}</div>
                    <div class="date">${edu.startDate} - ${edu.endDate || 'Present'}</div>
                </div>
            `;
        }
    }

    // Skills
    if (profile.skills && profile.skills.length > 0) {
        htmlContent += '<h2>Skills</h2>';
        htmlContent += `<p class="skills">${profile.skills.map((s) => escapeHtml(s.name)).join(', ')}</p>`;
    }

    htmlContent += '</body></html>';

    const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword',
    });
    downloadBlob(blob, filename || 'resume.doc');
}

const exportModule = {
    exportToJSON,
    exportToCSV,
    exportToPDF,
    exportToWord,
    exportData,
    exportResumeToJSON,
    exportResumeToPDF,
    exportResumeToWord,
};

export default exportModule;
