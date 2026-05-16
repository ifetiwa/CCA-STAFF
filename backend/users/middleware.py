"""
Middleware for session timeout and inactivity tracking.
"""

from django.shortcuts import redirect
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

# Session timeout in seconds (30 minutes)
SESSION_TIMEOUT = 30 * 60


class SessionTimeoutMiddleware:
    """
    Middleware to handle session timeout after inactivity.
    
    If a user is inactive for more than SESSION_TIMEOUT seconds,
    they will be logged out on their next request.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        """Handle request and check for session timeout."""
        
        # Only check timeout for authenticated users
        if request.user.is_authenticated:
            # Skip session timeout for certain URLs
            skip_timeout_urls = [
                '/login/',
                '/logout/',
                '/static/',
                '/media/',
                '/check-session/',
                '/api/',
            ]
            
            if not any(request.path.startswith(url) for url in skip_timeout_urls):
                last_activity = request.session.get('last_activity')
                
                if last_activity:
                    # Convert stored timestamp back to datetime if needed
                    if isinstance(last_activity, str):
                        try:
                            last_activity = timezone.datetime.fromisoformat(last_activity)
                        except (ValueError, AttributeError):
                            last_activity = None
                    elif isinstance(last_activity, (int, float)):
                        last_activity = timezone.datetime.fromtimestamp(last_activity)
                    
                    # Check if session has timed out
                    if last_activity:
                        time_elapsed = (timezone.now() - last_activity).total_seconds()
                        
                        if time_elapsed > SESSION_TIMEOUT:
                            # Session has timed out - log out user
                            logger.warning(
                                f"Session timeout for user {request.user.username} "
                                f"after {time_elapsed} seconds of inactivity"
                            )
                            
                            # Clear session
                            request.session.flush()
                            
                            # Redirect to login with timeout message
                            return redirect('/login/?timeout=true')
                
                # Update last activity time
                request.session['last_activity'] = timezone.now().isoformat()
        
        response = self.get_response(request)
        return response


class SecurityHeadersMiddleware:
    """
    Middleware to add security headers to all responses.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        response = self.get_response(request)
        
        # Add security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
        
        return response
