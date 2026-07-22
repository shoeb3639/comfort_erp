# Cablix Postman Collection

Import both JSON files in this directory into Postman and select the **Cablix Local** environment.

Set `login_password` to the local administrator password from `backend/.env`. The password is intentionally excluded from source control. Run **Authentication APIs / Login** first; it automatically stores the issued access and refresh tokens for protected requests.

The collection follows the approved API boundaries: Public, Authentication, Platform, and Tenant. Every new backend endpoint must be added to its corresponding folder when it is implemented.
