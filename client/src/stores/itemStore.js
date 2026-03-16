import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import initialData from '@/assets/items.json';

const STORAGE_KEY = 'lostAndFound_items';

export const useItemStore = defineStore('itemStore', () => {
    const items = ref([]);

    // Load items from localStorage, fallback to initial JSON data
    const loadItems = () => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                items.value = JSON.parse(stored);
            } catch {
                items.value = [...initialData.items];
            }
        } else {
            items.value = [...initialData.items];
        }
    };

    // Save items to localStorage
    const saveItems = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value));
    };

    // Watch for changes and persist
    watch(items, saveItems, { deep: true });

    // Add a new item
    const addItem = (item) => {
        items.value.push(item);
    };

    // Delete an item by ID
    const deleteItem = (id) => {
        items.value = items.value.filter((item) => item.id !== id);
    };

    // Generate a unique ID
    const generateId = () => {
        const maxNum = items.value.reduce((max, item) => {
            const num = parseInt(item.id.replace('lf-', ''), 10);
            return num > max ? num : max;
        }, 0);
        return `lf-${String(maxNum + 1).padStart(3, '0')}`;
    };

    // Initialize on creation
    loadItems();

    return { items, addItem, deleteItem, generateId, loadItems };
});
