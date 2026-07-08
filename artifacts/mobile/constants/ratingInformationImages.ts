import { Image, type ImageSourcePropType } from 'react-native';

export const RATING_INFORMATION_IMAGES = {
  rating: require('../assets/images/rating-info/rating.png'),
  onTheRoute: require('../assets/images/rating-info/on-the-route.png'),
  readyToMove: require('../assets/images/rating-info/ready-to-move.png'),
  traffic: require('../assets/images/rating-info/traffic.png'),
} as const satisfies Record<string, ImageSourcePropType>;

const RATING_INFORMATION_IMAGE_SOURCES = Object.values(RATING_INFORMATION_IMAGES);

export function prefetchRatingInformationImages() {
  if (typeof Image.resolveAssetSource !== 'function' || typeof Image.prefetch !== 'function') return;

  RATING_INFORMATION_IMAGE_SOURCES.forEach(source => {
    const uri = Image.resolveAssetSource(source)?.uri;
    if (uri) void Image.prefetch(uri).catch(() => {});
  });
}
