from rest_framework import filters, viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.permissions import IsAdminStaff

from .models import DesignationOption
from .serializers import DesignationOptionSerializer


class DesignationOptionViewSet(viewsets.ModelViewSet):
    """CRUD endpoint backing the React designation picker.

    Reads (`list`, `retrieve`) require authentication; writes (`create`,
    `update`, `partial_update`, `destroy`) additionally require the
    Super Admin or Admin Staff role.
    """

    queryset = DesignationOption.objects.all()
    serializer_class = DesignationOptionSerializer
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['name']
    ordering = ['name']
    pagination_class = None  # The full list is small — return all rows.

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminStaff()]
