#!/usr/bin/env node

/**
 * Generate Deployment Info Script
 * Creates deployment information file during build process
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Get Git commit information
 */
function getGitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const shortCommit = commit.substring(0, 8);
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const commitDate = execSync('git log -1 --format=%cI', { encoding: 'utf8' }).trim();
    
    return {
      commit,
      shortCommit,
      branch,
      commitDate
    };
  } catch (error) {
    console.warn('Failed to get Git info:', error.message);
    return {
      commit: 'unknown',
      shortCommit: 'unknown',
      branch: 'unknown',
      commitDate: new Date().toISOString()
    };
  }
}

/**
 * Get package version
 */
function getPackageVersion() {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || '1.0.0';
  } catch (error) {
    console.warn('Failed to get package version:', error.message);
    return '1.0.0';
  }
}

/**
 * Generate version string
 */
function generateVersion(packageVersion, gitInfo) {
  const timestamp = new Date();
  const year = timestamp.getFullYear();
  const month = String(timestamp.getMonth() + 1).padStart(2, '0');
  const day = String(timestamp.getDate()).padStart(2, '0');
  const hour = String(timestamp.getHours()).padStart(2, '0');
  const minute = String(timestamp.getMinutes()).padStart(2, '0');
  
  // Use package version as base, add timestamp and commit info
  const baseVersion = packageVersion;
  const buildSuffix = `${year}${month}${day}.${hour}${minute}`;
  
  if (gitInfo.shortCommit !== 'unknown') {
    return `${baseVersion}-${buildSuffix}-${gitInfo.shortCommit}`;
  }
  
  return `${baseVersion}-${buildSuffix}`;
}

/**
 * Generate deployment info
 */
function generateDeploymentInfo() {
  const gitInfo = getGitInfo();
  const packageVersion = getPackageVersion();
  const version = generateVersion(packageVersion, gitInfo);
  const timestamp = Date.now();
  const buildTime = new Date().toISOString();
  
  // Get environment information
  const environment = process.env.NODE_ENV || 
                     process.env.VERCEL_ENV || 
                     process.env.NETLIFY_CONTEXT || 
                     'production';

  const deploymentInfo = {
    version,
    buildId: process.env.NEXT_PUBLIC_BUILD_ID || gitInfo.commit || timestamp.toString(),
    timestamp,
    buildTime,
    environment,
    gitCommit: gitInfo.commit,
    gitBranch: gitInfo.branch,
    gitCommitDate: gitInfo.commitDate,
    packageVersion,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    // Deployment platform specific info
    vercel: {
      url: process.env.VERCEL_URL,
      region: process.env.VERCEL_REGION,
      env: process.env.VERCEL_ENV
    },
    netlify: {
      context: process.env.CONTEXT,
      branch: process.env.BRANCH,
      commitRef: process.env.COMMIT_REF
    }
  };

  return deploymentInfo;
}

/**
 * Write deployment info to files
 */
function writeDeploymentInfo(deploymentInfo) {
  const publicDir = path.join(process.cwd(), 'public');
  const nextStaticDir = path.join(process.cwd(), '.next', 'static');
  
  // Ensure directories exist
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  // Write to public directory (accessible via /deployment-info.json)
  const publicPath = path.join(publicDir, 'deployment-info.json');
  fs.writeFileSync(publicPath, JSON.stringify(deploymentInfo, null, 2));
  console.log('✅ Deployment info written to:', publicPath);
  
  // Write to .next/static directory (accessible via /_next/static/deployment-info.json)
  if (fs.existsSync(nextStaticDir)) {
    const staticPath = path.join(nextStaticDir, 'deployment-info.json');
    fs.writeFileSync(staticPath, JSON.stringify(deploymentInfo, null, 2));
    console.log('✅ Deployment info written to:', staticPath);
  }
  
  // Write environment variables for runtime access
  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  // Remove existing deployment-related env vars
  envContent = envContent.replace(/^NEXT_PUBLIC_APP_VERSION=.*$/gm, '');
  envContent = envContent.replace(/^NEXT_PUBLIC_BUILD_ID=.*$/gm, '');
  envContent = envContent.replace(/^BUILD_TIME=.*$/gm, '');
  
  // Add new deployment info
  envContent += `\n# Auto-generated deployment info\n`;
  envContent += `NEXT_PUBLIC_APP_VERSION=${deploymentInfo.version}\n`;
  envContent += `NEXT_PUBLIC_BUILD_ID=${deploymentInfo.buildId}\n`;
  envContent += `BUILD_TIME=${deploymentInfo.buildTime}\n`;
  
  fs.writeFileSync(envPath, envContent.trim() + '\n');
  console.log('✅ Environment variables updated in:', envPath);
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Generating deployment info...');
  
  try {
    const deploymentInfo = generateDeploymentInfo();
    writeDeploymentInfo(deploymentInfo);
    
    console.log('📦 Deployment Info Generated:');
    console.log(`   Version: ${deploymentInfo.version}`);
    console.log(`   Build ID: ${deploymentInfo.buildId}`);
    console.log(`   Environment: ${deploymentInfo.environment}`);
    console.log(`   Git Commit: ${deploymentInfo.gitCommit}`);
    console.log(`   Build Time: ${deploymentInfo.buildTime}`);
    
  } catch (error) {
    console.error('❌ Failed to generate deployment info:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  generateDeploymentInfo,
  writeDeploymentInfo,
  getGitInfo,
  getPackageVersion
};