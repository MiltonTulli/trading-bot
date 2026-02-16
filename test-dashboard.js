#!/usr/bin/env bun

// Test script to verify the dashboard setup
import { existsSync } from 'fs'
import { join } from 'path'

console.log('🔍 Testing Trading Bot Dashboard Setup...\n')

const checks = []

// Check if dashboard directory exists
const dashboardDir = './dashboard'
checks.push({
  name: 'Dashboard directory',
  passed: existsSync(dashboardDir),
  path: dashboardDir
})

// Check if built files exist
const distDir = './dashboard/dist'
checks.push({
  name: 'Built frontend',
  passed: existsSync(distDir) && existsSync(join(distDir, 'index.html')),
  path: distDir
})

// Check if server files exist
const serverFile = './dashboard/src/server/index.ts'
checks.push({
  name: 'Server entry point',
  passed: existsSync(serverFile),
  path: serverFile
})

// Check if components exist
const componentsDir = './dashboard/src/components'
const requiredComponents = [
  'Dashboard.tsx',
  'Layout.tsx', 
  'StatsCards.tsx',
  'CandlestickChart.tsx',
  'EquityCurve.tsx',
  'TradesTable.tsx',
  'MonthlyHeatmap.tsx',
  'BotControls.tsx',
  'PositionCard.tsx',
  'BacktestPanel.tsx'
]

requiredComponents.forEach(component => {
  checks.push({
    name: `Component: ${component}`,
    passed: existsSync(join(componentsDir, component)),
    path: join(componentsDir, component)
  })
})

// Check package.json
const packageFile = './dashboard/package.json'
checks.push({
  name: 'Package configuration',
  passed: existsSync(packageFile),
  path: packageFile
})

// Display results
let allPassed = true
checks.forEach(check => {
  const status = check.passed ? '✅' : '❌'
  console.log(`${status} ${check.name}`)
  if (!check.passed) {
    console.log(`   Missing: ${check.path}`)
    allPassed = false
  }
})

console.log('\n' + '='.repeat(50))

if (allPassed) {
  console.log('🎉 All checks passed! Dashboard is ready.')
  console.log('\n📊 To start the dashboard:')
  console.log('   bun run dashboard')
  console.log('\n🌐 Then visit: http://localhost:3000')
} else {
  console.log('❌ Some checks failed. Please review the missing files.')
  process.exit(1)
}

console.log('\n🚀 Happy Trading!')