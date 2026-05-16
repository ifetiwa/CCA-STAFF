# Install the daily encrypted-backup task in Windows Task Scheduler.
#
# Run from an elevated PowerShell session (right-click → Run as administrator).
# The task fires daily at 02:00 local time as the current user.
#
# Before scheduling, make sure your .env (in backend/) contains:
#   DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
#   BACKUP_ENCRYPTION_KEY   (a Fernet key — see backup_db.py header)
#   BACKUP_DIR              (e.g. C:\Secure\Backups\CCA)
#   PG_DUMP_PATH            (absolute path to pg_dump.exe)

[CmdletBinding()]
param(
    [string]$TaskName = "CCA-StaffBiodata-DailyBackup",
    [string]$StartTime = "02:00",
    [string]$PythonExe = "python.exe"
)

$ErrorActionPreference = "Stop"
$ScriptPath = Join-Path $PSScriptRoot "backup_db.py"
if (-not (Test-Path $ScriptPath)) {
    throw "Cannot find backup_db.py at $ScriptPath"
}

$Action  = New-ScheduledTaskAction -Execute $PythonExe -Argument "`"$ScriptPath`""
$Trigger = New-ScheduledTaskTrigger -Daily -At $StartTime
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable:$false `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Daily encrypted PostgreSQL backup for the CCA Staff Biodata system." `
    -Force | Out-Null

Write-Host "Installed scheduled task '$TaskName' (daily at $StartTime)."
Write-Host "Run it once manually to confirm:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
