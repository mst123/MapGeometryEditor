<template>
  <div id="map">
    <MapTools v-if="map" :map="map" />
  </div>
</template>

<script setup lang="ts">
import { onMounted,  shallowRef  } from 'vue'
import "ol/ol.css";
import Map from "ol/Map";
import View from "ol/View";

import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import MapTools from './MapTools.vue';

const map = shallowRef<Map | null>(null)

onMounted(() => {
  const base = new TileLayer({ source: new OSM() })
  map.value = new Map({
    layers: [base],
    target: 'map',
    view: new View({
      projection: "EPSG:4326",
      center: [103, 36],
      zoom: 7,
      maxZoom: 18
    })
  })
})
</script>
<style scoped>
#map {
  width: 100%;
  height: 100%;
  position: relative;
  .map-tools{
    position: absolute;
    top: 50px;
    right: 50px;
    z-index: 10;
  }
}
</style>
