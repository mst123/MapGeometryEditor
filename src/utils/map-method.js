import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'

export function createVectorLayer(options = {}) {
  return new VectorLayer({
    source: new VectorSource(),
    ...options
  })
} 