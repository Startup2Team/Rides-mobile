import {
  closeTemporaryScreen,
  navigateToCustomerHomeAfterCompletion,
  navigateToDriverHomeAfterCompletion,
  pushFlowScreen,
  replaceAuthBoundary,
  replaceFlowScreen,
} from '../navigationPolicy';

function createRouter(canGoBack = true) {
  return {
    back: jest.fn(),
    canGoBack: jest.fn(() => canGoBack),
    push: jest.fn(),
    replace: jest.fn(),
  };
}

describe('navigation policy helpers', () => {
  test('push and replace helpers call the expected router methods', () => {
    const router = createRouter();

    pushFlowScreen(router, '/map-picker');
    replaceFlowScreen(router, '/saved-place-selector');
    replaceAuthBoundary(router, '/(auth)/welcome');
    navigateToCustomerHomeAfterCompletion(router);
    navigateToDriverHomeAfterCompletion(router);

    expect(router.push).toHaveBeenCalledWith('/map-picker');
    expect(router.replace).toHaveBeenCalledWith('/saved-place-selector');
    expect(router.replace).toHaveBeenCalledWith('/(auth)/welcome');
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(router.replace).toHaveBeenCalledWith('/(driver)');
  });

  test('closeTemporaryScreen prefers back and falls back to replace', () => {
    const backRouter = createRouter(true);
    closeTemporaryScreen(backRouter, '/driver-packages');
    expect(backRouter.back).toHaveBeenCalled();
    expect(backRouter.replace).not.toHaveBeenCalled();

    const fallbackRouter = createRouter(false);
    closeTemporaryScreen(fallbackRouter, '/driver-packages');
    expect(fallbackRouter.back).not.toHaveBeenCalled();
    expect(fallbackRouter.replace).toHaveBeenCalledWith('/driver-packages');
  });
});
