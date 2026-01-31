// global-setup.ts
import { spawnSync } from 'bun'

export default function globalSetup() {
  console.log('Running global build before tests...')

  const result = spawnSync(['bun', 'run', 'build'], {
    stdio: ['inherit', 'inherit', 'pipe'], // show stdout/stdin, capture stderr
    cwd: process.cwd(), // usually fine, or set explicitly
    // env: { ...process.env, SOME_VAR: 'value' },  // optional
  })

  if (result.success) {
    console.log('Build completed successfully ✅')
  } else {
    console.error('Build failed:')
    console.error(result.stderr?.toString() || 'No error output')
    // Important: fail the whole test run if build breaks
    throw new Error('bun run build failed')
    // or process.exit(1); if you prefer
  }
}
