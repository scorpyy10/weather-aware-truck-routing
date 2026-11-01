from django.urls import path
from routing.views import RouteCalculateView, GeocodingSearchView

urlpatterns = [
    path('routes/calculate/', RouteCalculateView.as_view(), name='route-calculate'),
    path('geocoding/search/', GeocodingSearchView.as_view(), name='geocoding-search'),
]
