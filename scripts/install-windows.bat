@echo off

cd /d %~dp0\..
echo Running in: %cd%

necho Installing node modules...
call npm install
nIF %ERRORLEVEL% NEQ 0 (
  echo npm install failed with exit code %ERRORLEVEL%.
  exit /b %ERRORLEVEL%
)

necho Ensuring .env exists...
if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo Created .env from .env.example
  ) else (
    echo Warning: .env.example not found; creating empty .env
    type nul > ".env"
  )
) else (
  echo .env already exists — skipping copy.
)

necho Creating folders: data, transcripts
if not exist "data" mkdir "data"
if not exist "transcripts" mkdir "transcripts"
echo Done.
exit /b 0
