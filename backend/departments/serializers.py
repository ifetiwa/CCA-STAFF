from rest_framework import serializers

from .models import DesignationOption


class DesignationOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DesignationOption
        fields = ('id', 'name')

    def validate_name(self, value):
        cleaned = (value or '').strip()
        if not cleaned:
            raise serializers.ValidationError('Designation name is required.')
        qs = DesignationOption.objects.filter(name__iexact=cleaned)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'A designation with that name already exists.'
            )
        return cleaned
