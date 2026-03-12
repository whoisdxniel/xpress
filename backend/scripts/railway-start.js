const path = require('path')
const fs = require('fs')
const childProcess = require('child_process')

const root = path.resolve(__dirname, '..')

function prismaCliJs() {
  return path.join(root, 'node_modules', 'prisma', 'build', 'index.js')
}

function run(cmd, args, envOverride) {
  const isWindowsCmd = process.platform === 'win32' && String(cmd).toLowerCase().endsWith('.cmd')
  const result = isWindowsCmd
    ? childProcess.spawnSync('cmd.exe', ['/d', '/s', '/c', `"${cmd}" ${args.join(' ')}`], {
        stdio: 'inherit',
        cwd: root,
        env: { ...process.env, ...envOverride },
      })
    : childProcess.spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd: root,
        env: { ...process.env, ...envOverride },
      })
  return result.status ?? 1
}

function main() {
  const prismaCli = prismaCliJs()
  if (!fs.existsSync(prismaCli)) {
    console.error('[railway] prisma CLI no está instalado. Revisá dependencies.')
    process.exit(1)
  }

  // Para Neon: usar DIRECT_URL para migraciones si existe
  const migrationDbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!migrationDbUrl) {
    console.error('[railway] falta DATABASE_URL (y opcional DIRECT_URL).')
    process.exit(1)
  }

  console.log('[railway] running prisma migrate deploy')
  const migrateCode = run(process.execPath, [prismaCli, 'migrate', 'deploy'], { DATABASE_URL: migrationDbUrl })
  if (migrateCode !== 0) process.exit(migrateCode)

  console.log('[railway] starting server')
  const node = process.execPath
  const startCode = run(node, ['dist/server.js'], { DATABASE_URL: process.env.DATABASE_URL })
  process.exit(startCode)
}

main()
