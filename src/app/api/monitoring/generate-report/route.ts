import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

/**
 * API endpoint for generating automated security and performance reports
 * Requirements: 4.5, 2.4
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reportType = 'security-performance', includeAlerts = true, includeTrends = true } = body;

    // Validate report type
    if (reportType !== 'security-performance') {
      return NextResponse.json(
        { error: 'Invalid report type. Only "security-performance" is supported.' },
        { status: 400 }
      );
    }

    // Generate report using the automated report generator
    const reportResult = await generateReport({
      reportType,
      includeAlerts,
      includeTrends
    });

    if (!reportResult.success) {
      return NextResponse.json(
        { error: 'Failed to generate report', details: reportResult.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Report generated successfully',
      reportUrl: reportResult.reportUrl,
      filename: reportResult.filename,
      timestamp: new Date().toISOString(),
      metadata: {
        reportType,
        includeAlerts,
        includeTrends,
        generatedAt: reportResult.generatedAt,
        fileSize: reportResult.fileSize
      }
    });

  } catch (error) {
    console.error('Report generation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during report generation' },
      { status: 500 }
    );
  }
}

async function generateReport(options: {
  reportType: string;
  includeAlerts: boolean;
  includeTrends: boolean;
}): Promise<{
  success: boolean;
  reportUrl?: string;
  filename?: string;
  generatedAt?: string;
  fileSize?: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'automated-report-generator.js');
    
    const child = spawn('node', [scriptPath], {
      stdio: 'pipe',
      env: {
        ...process.env,
        REPORT_OPTIONS: JSON.stringify(options)
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', async (code) => {
      if (code === 0) {
        try {
          // Find the generated report files
          const reportsDir = path.join(process.cwd(), 'ci-reports');
          const files = await fs.readdir(reportsDir);
          
          // Find the most recent HTML report
          const htmlReports = files
            .filter(f => f.startsWith('security-performance-report-') && f.endsWith('.html'))
            .sort()
            .reverse();

          if (htmlReports.length > 0) {
            const latestReport = htmlReports[0];
            const reportPath = path.join(reportsDir, latestReport);
            const stats = await fs.stat(reportPath);
            
            // Create a public URL for the report (in a real app, you'd serve this properly)
            const reportUrl = `/api/monitoring/reports/${latestReport}`;
            
            resolve({
              success: true,
              reportUrl,
              filename: latestReport,
              generatedAt: stats.mtime.toISOString(),
              fileSize: stats.size
            });
          } else {
            resolve({
              success: false,
              error: 'No report files found after generation'
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: `Failed to locate generated report: ${error}`
          });
        }
      } else {
        resolve({
          success: false,
          error: `Report generation failed with exit code ${code}: ${stderr}`
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to execute report generator: ${error.message}`
      });
    });
  });
}

export async function GET() {
  return NextResponse.json({
    message: 'Report generation endpoint',
    usage: 'POST to this endpoint with report configuration',
    supportedReportTypes: ['security-performance'],
    options: {
      reportType: 'string (required)',
      includeAlerts: 'boolean (optional, default: true)',
      includeTrends: 'boolean (optional, default: true)'
    }
  });
}