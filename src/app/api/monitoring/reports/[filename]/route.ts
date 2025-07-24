import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

/**
 * API endpoint for serving generated monitoring reports
 * Requirements: 4.5, 2.4
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Only allow specific report file patterns
    const allowedPatterns = [
      /^security-performance-report-\d+\.html$/,
      /^security-performance-report-\d+\.json$/,
      /^alert-summary-\d+\.json$/
    ];

    const isAllowed = allowedPatterns.some(pattern => pattern.test(filename));
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 403 }
      );
    }

    const reportsDir = path.join(process.cwd(), 'ci-reports');
    const filePath = path.join(reportsDir, filename);

    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    const fileContent = await fs.readFile(filePath);
    const stats = await fs.stat(filePath);

    // Determine content type
    let contentType = 'application/octet-stream';
    if (filename.endsWith('.html')) {
      contentType = 'text/html';
    } else if (filename.endsWith('.json')) {
      contentType = 'application/json';
    }

    // Set appropriate headers
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': stats.size.toString(),
      'Last-Modified': stats.mtime.toUTCString(),
      'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      'Content-Disposition': `inline; filename="${filename}"`
    });

    return new NextResponse(fileContent, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Report serving error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Validate filename
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    // Only allow deletion of report files
    const allowedPatterns = [
      /^security-performance-report-\d+\.html$/,
      /^security-performance-report-\d+\.json$/,
      /^alert-summary-\d+\.json$/
    ];

    const isAllowed = allowedPatterns.some(pattern => pattern.test(filename));
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'File type not allowed for deletion' },
        { status: 403 }
      );
    }

    const reportsDir = path.join(process.cwd(), 'ci-reports');
    const filePath = path.join(reportsDir, filename);

    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
      
      return NextResponse.json({
        success: true,
        message: `Report ${filename} deleted successfully`
      });
    } catch {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

  } catch (error) {
    console.error('Report deletion error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}