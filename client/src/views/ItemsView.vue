<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useQuasar } from 'quasar';
import { useItemStore } from '@/stores/itemStore';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon paths for Vite bundler
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const $q = useQuasar();
const itemStore = useItemStore();

const items = computed(() => itemStore.items);

// ── Table columns ──
const columns = [
  { name: 'type', label: 'Typ', field: 'type', align: 'center', sortable: true },
  { name: 'title', label: 'Titel', field: 'title', align: 'center', sortable: true },
  { name: 'category', label: 'Kategorie', field: 'category', align: 'center', sortable: true },
  { name: 'status', label: 'Status', field: 'status', align: 'center', sortable: true },
  {
    name: 'timestamp',
    label: 'Datum',
    field: (row) => row.context.timestamp,
    align: 'center',
    sortable: true,
    format: (val) => new Date(val).toLocaleString(),
  },
  { name: 'actions', label: 'Aktionen', field: 'actions', align: 'center', sortable: false },
];

const statusColor = (status) => {
  switch (status) {
    case 'open':
      return 'warning';
    case 'processing':
      return 'info';
    case 'handed-in':
      return 'positive';
    default:
      return 'grey';
  }
};

// ── Create Dialog ──
const showCreateDialog = ref(false);
const newItem = ref({
  title: '',
  description: '',
  category: 'Sonstiges',
  type: 'lost',
});
const gpsLocation = ref(null);
const gpsLoading = ref(false);
const gpsError = ref('');
let createMap = null;
let createMarker = null;

// Default center (Austria) if GPS is not available
const defaultCenter = { lat: 47.5, lng: 13.0 };

const categories = [
  'Taschen & Rucksäcke',
  'Schlüssel',
  'Elektronik',
  'Geldbörsen',
  'Kleidung',
  'Dokumente',
  'Sonstiges',
];

const initCreateMap = () => {
  nextTick(() => {
    setTimeout(() => {
      const container = document.getElementById('create-map');
      if (!container) return;

      if (createMap) {
        createMap.remove();
        createMap = null;
        createMarker = null;
      }

      const center = gpsLocation.value || defaultCenter;
      const zoom = gpsLocation.value ? 15 : 7;
      createMap = L.map('create-map').setView([center.lat, center.lng], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(createMap);

      if (gpsLocation.value) {
        createMarker = L.marker([center.lat, center.lng]).addTo(createMap);
      }

      // Click on map to set/move marker
      createMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        gpsLocation.value = { lat, lng };

        if (createMarker) {
          createMarker.setLatLng([lat, lng]);
        } else {
          createMarker = L.marker([lat, lng]).addTo(createMap);
        }
      });
    }, 150);
  });
};

const openCreateDialog = () => {
  // Reset form
  newItem.value = {
    title: '',
    description: '',
    category: 'Sonstiges',
    type: 'lost',
  };
  gpsLocation.value = null;
  gpsError.value = '';
  showCreateDialog.value = true;

  // Request GPS location
  fetchLocation();

  // Init map after dialog is rendered
  initCreateMap();
};

const fetchLocation = () => {
  if (!navigator.geolocation) {
    gpsError.value = 'Geolocation wird nicht unterstützt.';
    return;
  }

  gpsLoading.value = true;
  gpsError.value = '';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      gpsLocation.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      gpsLoading.value = false;

      // Update create map if open
      if (createMap) {
        createMap.setView([position.coords.latitude, position.coords.longitude], 15);
        if (createMarker) {
          createMarker.setLatLng([position.coords.latitude, position.coords.longitude]);
        } else {
          createMarker = L.marker([position.coords.latitude, position.coords.longitude]).addTo(createMap);
        }
      }
    },
    (err) => {
      gpsError.value = `Standort konnte nicht ermittelt werden: ${err.message}`;
      gpsLoading.value = false;
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

const saveNewItem = () => {
  if (!newItem.value.title.trim()) {
    $q.notify({ type: 'negative', message: 'Bitte einen Titel eingeben.' });
    return;
  }

  const item = {
    id: itemStore.generateId(),
    type: newItem.value.type,
    title: newItem.value.title.trim(),
    description: newItem.value.description.trim(),
    category: newItem.value.category,
    image: {
      captured: false,
      reason: 'Kein Bild aufgenommen',
    },
    location: {
      gps: gpsLocation.value || { lat: 0, lng: 0 },
      accuracy_m: gpsLocation.value ? 15 : 0,
    },
    context: {
      capturedOffline: !navigator.onLine,
      batteryLevel: null,
      lightSensor: null,
      timestamp: new Date().toISOString(),
    },
    status: 'open',
  };

  itemStore.addItem(item);
  showCreateDialog.value = false;

  // Cleanup create map
  if (createMap) {
    createMap.remove();
    createMap = null;
    createMarker = null;
  }

  $q.notify({ type: 'positive', message: 'Item wurde hinzugefügt!' });
};

// ── Detail Dialog ──
const showDetailDialog = ref(false);
const selectedItem = ref(null);
let detailMap = null;

const openDetailDialog = (item) => {
  selectedItem.value = item;
  showDetailDialog.value = true;
};

watch(showDetailDialog, (isOpen) => {
  if (isOpen && selectedItem.value) {
    nextTick(() => {
      setTimeout(() => {
        const container = document.getElementById('detail-map');
        if (!container) return;

        // Cleanup previous map instance
        if (detailMap) {
          detailMap.remove();
          detailMap = null;
        }

        const { lat, lng } = selectedItem.value.location.gps;
        detailMap = L.map('detail-map').setView([lat, lng], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(detailMap);

        L.marker([lat, lng])
          .addTo(detailMap)
          .bindPopup(`<b>${selectedItem.value.title}</b>`)
          .openPopup();
      }, 100);
    });
  } else {
    if (detailMap) {
      detailMap.remove();
      detailMap = null;
    }
  }
});

// ── Delete ──
const confirmDelete = (item) => {
  $q.dialog({
    title: 'Item löschen',
    message: `Möchtest du "${item.title}" wirklich löschen?`,
    cancel: { label: 'Abbrechen', flat: true },
    ok: { label: 'Löschen', color: 'negative' },
    persistent: true,
  }).onOk(() => {
    itemStore.deleteItem(item.id);
    $q.notify({ type: 'info', message: 'Item wurde gelöscht.' });
  });
};
</script>

<template>
  <q-page class="q-pa-md">
    <div class="text-h5 q-mb-md">Items Table</div>

    <!-- ── Table View (Landscape) ── -->
    <div class="table-view">
      <q-table :rows="items" :columns="columns" row-key="id" flat bordered>
        <template v-slot:body-cell-type="props">
          <q-td :props="props">
            <q-chip
              :color="props.row.type === 'lost' ? 'negative' : 'positive'"
              text-color="white"
              dense
            >
              {{ props.row.type }}
            </q-chip>
          </q-td>
        </template>
        <template v-slot:body-cell-status="props">
          <q-td :props="props">
            <q-chip :color="statusColor(props.row.status)" text-color="white" dense>
              {{ props.row.status }}
            </q-chip>
          </q-td>
        </template>
        <template v-slot:body-cell-actions="props">
          <q-td :props="props">
            <q-btn
              flat
              round
              dense
              icon="visibility"
              color="accent"
              @click="openDetailDialog(props.row)"
              class="q-mr-xs"
            >
              <q-tooltip>Detail</q-tooltip>
            </q-btn>
            <q-btn
              flat
              round
              dense
              icon="delete"
              color="negative"
              @click="confirmDelete(props.row)"
            >
              <q-tooltip>Löschen</q-tooltip>
            </q-btn>
          </q-td>
        </template>
      </q-table>
    </div>

    <!-- ── List View (Portrait) ── -->
    <div class="list-view">
      <q-list bordered separator>
        <q-item v-for="item in items" :key="item.id" class="q-py-md">
          <q-item-section>
            <div class="row justify-between q-mb-sm">
              <span class="text-weight-medium">Gruppe</span>
              <span>{{ item.id }}</span>
            </div>

            <div class="row justify-between q-mb-sm">
              <span>Typ</span>
              <q-chip
                :color="item.type === 'lost' ? 'negative' : 'positive'"
                text-color="white"
                dense
              >
                {{ item.type }}
              </q-chip>
            </div>

            <div class="row justify-between q-mb-sm">
              <span>Titel</span>
              <span class="text-grey-8">{{ item.title }}</span>
            </div>

            <div class="row justify-between q-mb-sm">
              <span>Kategorie</span>
              <span class="text-grey-8">{{ item.category }}</span>
            </div>

            <div class="row justify-between q-mb-sm">
              <span>Status</span>
              <q-chip :color="statusColor(item.status)" text-color="white" dense>
                {{ item.status }}
              </q-chip>
            </div>

            <div class="row justify-between q-mb-sm">
              <span>Datum</span>
              <span class="text-grey-8">
                {{ new Date(item.context.timestamp).toLocaleString() }}
              </span>
            </div>

            <div class="row justify-end q-gutter-xs">
              <q-btn
                flat
                round
                dense
                icon="visibility"
                color="accent"
                @click="openDetailDialog(item)"
              >
                <q-tooltip>Detail</q-tooltip>
              </q-btn>
              <q-btn
                flat
                round
                dense
                icon="delete"
                color="negative"
                @click="confirmDelete(item)"
              >
                <q-tooltip>Löschen</q-tooltip>
              </q-btn>
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </div>

    <!-- ── FAB Button ── -->
    <q-page-sticky position="bottom-right" :offset="[18, 18]">
      <q-btn
        fab
        icon="add"
        color="accent"
        text-color="white"
        label="Hinzufügen"
        @click="openCreateDialog"
        class="add-btn"
      />
    </q-page-sticky>

    <!-- ── Create Dialog ── -->
    <q-dialog v-model="showCreateDialog" persistent>
      <q-card style="min-width: 340px; max-width: 500px; width: 90vw;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Neues Item erstellen</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-gutter-md q-pt-md">
          <q-select
            v-model="newItem.type"
            :options="[
              { label: 'Verloren', value: 'lost' },
              { label: 'Gefunden', value: 'found' },
            ]"
            emit-value
            map-options
            label="Typ"
            outlined
            dense
          />

          <q-input
            v-model="newItem.title"
            label="Titel *"
            outlined
            dense
            :rules="[(val) => !!val || 'Titel ist erforderlich']"
          />

          <q-input
            v-model="newItem.description"
            label="Beschreibung"
            outlined
            dense
            type="textarea"
            autogrow
          />

          <q-select
            v-model="newItem.category"
            :options="categories"
            label="Kategorie"
            outlined
            dense
          />

          <!-- GPS Location with Map -->
          <div class="q-pa-sm rounded-borders" style="background: rgba(124,152,179,0.1);">
            <div class="row items-center justify-between">
              <div class="row items-center q-gutter-sm">
                <q-icon name="location_on" color="accent" size="sm" />
                <span class="text-weight-medium">Standort</span>
              </div>
              <q-btn
                flat
                dense
                size="sm"
                icon="my_location"
                label="Mein Standort"
                color="accent"
                @click="fetchLocation"
                :loading="gpsLoading"
              />
            </div>
            <div v-if="gpsLoading && !gpsLocation" class="q-mt-sm">
              <q-spinner-dots color="accent" size="20px" />
              <span class="q-ml-sm text-grey-7">Standort wird ermittelt…</span>
            </div>
            <div v-if="gpsError && !gpsLocation" class="q-mt-sm text-negative text-caption">
              {{ gpsError }}
            </div>
            <div v-if="gpsLocation" class="q-mt-sm text-grey-8 text-caption">
              📍 {{ gpsLocation.lat.toFixed(5) }}, {{ gpsLocation.lng.toFixed(5) }}
            </div>
            <div class="q-mt-sm text-grey-6 text-caption" style="font-style: italic;">
              Klicke auf die Karte, um den Standort zu setzen oder zu ändern.
            </div>
            <div
              id="create-map"
              style="height: 250px; width: 100%; border-radius: 8px; margin-top: 8px; z-index: 0;"
            ></div>
          </div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Abbrechen" v-close-popup />
          <q-btn
            unelevated
            label="Speichern"
            color="accent"
            text-color="white"
            @click="saveNewItem"
          />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ── Detail Dialog ── -->
    <q-dialog v-model="showDetailDialog">
      <q-card style="min-width: 380px; max-width: 600px; width: 92vw;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">{{ selectedItem?.title }}</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section v-if="selectedItem" class="q-pt-md">
          <q-list dense>
            <q-item>
              <q-item-section side>
                <q-icon name="label" color="grey-7" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Typ</q-item-label>
                <q-item-label>
                  <q-chip
                    :color="selectedItem.type === 'lost' ? 'negative' : 'positive'"
                    text-color="white"
                    dense
                    size="sm"
                  >
                    {{ selectedItem.type === 'lost' ? 'Verloren' : 'Gefunden' }}
                  </q-chip>
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section side>
                <q-icon name="category" color="grey-7" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Kategorie</q-item-label>
                <q-item-label>{{ selectedItem.category }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item v-if="selectedItem.description">
              <q-item-section side>
                <q-icon name="description" color="grey-7" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Beschreibung</q-item-label>
                <q-item-label>{{ selectedItem.description }}</q-item-label>
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section side>
                <q-icon name="flag" color="grey-7" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Status</q-item-label>
                <q-item-label>
                  <q-chip
                    :color="statusColor(selectedItem.status)"
                    text-color="white"
                    dense
                    size="sm"
                  >
                    {{ selectedItem.status }}
                  </q-chip>
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section side>
                <q-icon name="event" color="grey-7" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>Datum</q-item-label>
                <q-item-label>
                  {{ new Date(selectedItem.context.timestamp).toLocaleString() }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-item>
              <q-item-section side>
                <q-icon name="location_on" color="grey-7" />
              </q-item-section>
              <q-item-section>
                <q-item-label caption>GPS-Koordinaten</q-item-label>
                <q-item-label>
                  {{ selectedItem.location.gps.lat.toFixed(6) }},
                  {{ selectedItem.location.gps.lng.toFixed(6) }}
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <!-- Leaflet Map -->
          <div
            id="detail-map"
            style="height: 300px; width: 100%; border-radius: 8px; margin-top: 12px; z-index: 0;"
          ></div>
        </q-card-section>

        <q-card-actions align="right" class="q-pa-md">
          <q-btn flat label="Schließen" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
@media (orientation: portrait) {
  .table-view {
    display: none;
  }
}
@media (orientation: landscape) {
  .list-view {
    display: none;
  }
}

.add-btn {
  box-shadow: 0 4px 12px rgba(124, 152, 179, 0.4);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.add-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(124, 152, 179, 0.5);
}
</style>
