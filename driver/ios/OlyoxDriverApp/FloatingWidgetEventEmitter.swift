import React
import Foundation

@objc(FloatingWidgetEventEmitter)
class FloatingWidgetEventEmitter: RCTEventEmitter {
  
  override init() {
    super.init()
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleFloatingWidgetTap),
      name: NSNotification.Name("FloatingWidgetTapped"),
      object: nil
    )
  }
  
  deinit {
    NotificationCenter.default.removeObserver(self)
  }
  
  @objc static override func requiresMainQueueSetup() -> Bool {
    return false
  }
  
  override func supportedEvents() -> [String]! {
    return ["FloatingWidgetTapped"]
  }
  
  @objc func handleFloatingWidgetTap(_ notification: Notification) {
    if let userInfo = notification.userInfo,
       let timestamp = userInfo["timestamp"] as? TimeInterval {
      sendEvent(withName: "FloatingWidgetTapped", body: ["timestamp": timestamp])
    }
  }
}