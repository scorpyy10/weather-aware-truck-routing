from rest_framework import serializers


class LocationSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90.0, max_value=90.0)
    lng = serializers.FloatField(min_value=-180.0, max_value=180.0)
    name = serializers.CharField(required=False, allow_blank=True, default="")


class RouteCalculationRequestSerializer(serializers.Serializer):
    origin = LocationSerializer()
    destination = LocationSerializer()
    departure_time = serializers.CharField(required=False, allow_blank=True, default="")
    load_weight = serializers.FloatField(min_value=0.0, max_value=80000.0, default=0.0)
    sampling_interval_miles = serializers.ChoiceField(
        choices=[10, 25, 50], default=25
    )
