import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { FloatingWidgetManager, FloatingWidgetEventEmitter } = NativeModules;

class FloatingWidget {
  constructor() {
    this.eventEmitter = null;
    this.listeners = [];
    
    if (Platform.OS === 'ios' && FloatingWidgetEventEmitter) {
      this.eventEmitter = new NativeEventEmitter(FloatingWidgetEventEmitter);
    }
  }

  /**
   * Show floating widget with customizable options
   * @param {Object} options - Widget configuration
   * @param {Object} options.size - Widget size {width: number, height: number}
   * @param {Object} options.position - Initial position {x: number, y: number}
   * @param {string} options.backgroundColor - Background color (hex)
   * @param {string} options.text - Text/icon to display
   * @param {string} options.textColor - Text color (hex)
   */
  show(options = {}) {
    if (Platform.OS !== 'ios' || !FloatingWidgetManager) {
      console.warn('FloatingWidget is only supported on iOS');
      return;
    }

    const defaultOptions = {
      size: { width: 60, height: 60 },
      position: { x: 50, y: 100 },
      backgroundColor: '#007AFF',
      text: '★',
      textColor: '#FFFFFF'
    };

    const finalOptions = { ...defaultOptions, ...options };
    FloatingWidgetManager.showFloatingWidget(finalOptions);
  }

  /**
   * Hide the floating widget
   */
  hide() {
    if (Platform.OS !== 'ios' || !FloatingWidgetManager) {
      return;
    }
    FloatingWidgetManager.hideFloatingWidget();
  }

  /**
   * Update widget position
   * @param {Object} position - New position {x: number, y: number}
   */
  updatePosition(position) {
    if (Platform.OS !== 'ios' || !FloatingWidgetManager) {
      return;
    }
    FloatingWidgetManager.updatePosition(position);
  }

  /**
   * Add event listener for widget interactions
   * @param {string} event - Event name ('tap')
   * @param {Function} callback - Callback function
   */
  addEventListener(event, callback) {
    if (!this.eventEmitter) return;

    let eventName;
    switch (event) {
      case 'tap':
        eventName = 'FloatingWidgetTapped';
        break;
      default:
        console.warn(`Unknown event: ${event}`);
        return;
    }

    const subscription = this.eventEmitter.addListener(eventName, callback);
    this.listeners.push(subscription);
    
    return subscription;
  }

  /**
   * Remove specific event listener
   * @param {Object} subscription - Subscription object returned from addEventListener
   */
  removeEventListener(subscription) {
    if (subscription && subscription.remove) {
      subscription.remove();
      this.listeners = this.listeners.filter(listener => listener !== subscription);
    }
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    this.listeners.forEach(listener => {
      if (listener && listener.remove) {
        listener.remove();
      }
    });
    this.listeners = [];
  }
}

export default new FloatingWidget();