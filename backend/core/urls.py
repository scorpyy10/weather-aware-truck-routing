from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.http import HttpResponse
from pathlib import Path


def spa_index_view(request):
    """Serves the compiled React index.html for frontend SPA routing."""
    index_file = settings.BASE_DIR.parent / 'frontend' / 'dist' / 'index.html'
    if index_file.exists():
        with open(index_file, 'r', encoding='utf-8') as f:
            return HttpResponse(f.read(), content_type='text/html')
    return HttpResponse(
        "<h1>Weather-Aware Truck Routing API</h1><p>Frontend is running on Vite dev server (port 5173) or run <code>npm run build</code> in <code>frontend/</code> to compile static bundle.</p>",
        content_type='text/html'
    )


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('routing.urls')),
    re_path(r'^(?!api|admin|static).*$', spa_index_view, name='spa-index'),
]
