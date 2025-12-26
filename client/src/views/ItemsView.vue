<script setup>
import { ref, onMounted} from 'vue';
import itemsData from '@/assets/items.json';

const items = ref([]);


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
];

onMounted(() => {
  items.value = itemsData.items;
});

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
</script>

<template>
  <q-page class="q-pa-md">
    <div class="text-h5 q-mb-md">Items Table</div>
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
      </q-table>
    </div>
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
          </q-item-section>
        </q-item>
      </q-list>
    </div>
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
</style>
