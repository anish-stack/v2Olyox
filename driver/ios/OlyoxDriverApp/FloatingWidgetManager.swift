import UIKit
import React

@objc(FloatingWidgetManager)
class FloatingWidgetManager: NSObject {
  
  private var floatingView: UIView?
  private var isShowing = false
  
  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
  
  @objc func showFloatingWidget(_ options: NSDictionary) {
    DispatchQueue.main.async {
      self.createFloatingWidget(options)
    }
  }
  
  @objc func hideFloatingWidget() {
    DispatchQueue.main.async {
      self.removeFloatingWidget()
    }
  }
  
  @objc func updatePosition(_ position: NSDictionary) {
    DispatchQueue.main.async {
      guard let floatingView = self.floatingView else { return }
      
      let x = position["x"] as? CGFloat ?? floatingView.frame.origin.x
      let y = position["y"] as? CGFloat ?? floatingView.frame.origin.y
      
      floatingView.frame.origin = CGPoint(x: x, y: y)
    }
  }
  
  private func createFloatingWidget(_ options: NSDictionary) {
    // Remove existing widget if any
    removeFloatingWidget()
    
    guard let window = UIApplication.shared.windows.first else { return }
    
    // Extract options
    let size = options["size"] as? NSDictionary
    let width = size?["width"] as? CGFloat ?? 60
    let height = size?["height"] as? CGFloat ?? 60
    
    let position = options["position"] as? NSDictionary
    let x = position?["x"] as? CGFloat ?? 50
    let y = position?["y"] as? CGFloat ?? 100
    
    let backgroundColor = options["backgroundColor"] as? String ?? "#007AFF"
    let text = options["text"] as? String ?? "★"
    let textColor = options["textColor"] as? String ?? "#FFFFFF"
    
    // Create floating view
    floatingView = UIView(frame: CGRect(x: x, y: y, width: width, height: height))
    guard let floatingView = floatingView else { return }
    
    // Style the floating view
    floatingView.backgroundColor = UIColor(hexString: backgroundColor)
    floatingView.layer.cornerRadius = min(width, height) / 2
    floatingView.layer.shadowColor = UIColor.black.cgColor
    floatingView.layer.shadowOffset = CGSize(width: 0, height: 2)
    floatingView.layer.shadowRadius = 4
    floatingView.layer.shadowOpacity = 0.3
    
    // Add text/icon
    let label = UILabel(frame: floatingView.bounds)
    label.text = text
    label.textAlignment = .center
    label.textColor = UIColor(hexString: textColor)
    label.font = UIFont.systemFont(ofSize: 20, weight: .medium)
    floatingView.addSubview(label)
    
    // Add pan gesture for dragging
    let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
    floatingView.addGestureRecognizer(panGesture)
    
    // Add tap gesture
    let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
    floatingView.addGestureRecognizer(tapGesture)
    
    // Add to window with highest level
    window.addSubview(floatingView)
    window.windowLevel = UIWindow.Level.statusBar + 1
    
    isShowing = true
    
    // Add entrance animation
    floatingView.transform = CGAffineTransform(scaleX: 0.1, y: 0.1)
    UIView.animate(withDuration: 0.3, delay: 0, usingSpringWithDamping: 0.8, initialSpringVelocity: 0.5, options: .curveEaseInOut, animations: {
      floatingView.transform = CGAffineTransform.identity
    }, completion: nil)
  }
  
  private func removeFloatingWidget() {
    guard let floatingView = floatingView else { return }
    
    UIView.animate(withDuration: 0.2, animations: {
      floatingView.alpha = 0
      floatingView.transform = CGAffineTransform(scaleX: 0.1, y: 0.1)
    }) { _ in
      floatingView.removeFromSuperview()
      self.floatingView = nil
      self.isShowing = false
    }
  }
  
  @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
    guard let floatingView = floatingView else { return }
    
    let translation = gesture.translation(in: floatingView.superview)
    
    switch gesture.state {
    case .changed:
      floatingView.center = CGPoint(
        x: floatingView.center.x + translation.x,
        y: floatingView.center.y + translation.y
      )
      gesture.setTranslation(.zero, in: floatingView.superview)
    case .ended:
      // Snap to edges
      snapToEdge()
    default:
      break
    }
  }
  
  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    // Send event to React Native
    NotificationCenter.default.post(
      name: NSNotification.Name("FloatingWidgetTapped"),
      object: nil,
      userInfo: ["timestamp": Date().timeIntervalSince1970]
    )
  }
  
  private func snapToEdge() {
    guard let floatingView = floatingView,
          let superview = floatingView.superview else { return }
    
    let centerX = floatingView.center.x
    let screenWidth = superview.bounds.width
    let margin: CGFloat = 10
    
    let targetX: CGFloat
    if centerX < screenWidth / 2 {
      targetX = floatingView.bounds.width / 2 + margin
    } else {
      targetX = screenWidth - floatingView.bounds.width / 2 - margin
    }
    
    // Keep within screen bounds vertically
    let minY = floatingView.bounds.height / 2 + 44 // Status bar height
    let maxY = superview.bounds.height - floatingView.bounds.height / 2 - 34 // Home indicator
    let targetY = max(minY, min(maxY, floatingView.center.y))
    
    UIView.animate(withDuration: 0.3, delay: 0, usingSpringWithDamping: 0.8, initialSpringVelocity: 0.5, options: .curveEaseInOut, animations: {
      floatingView.center = CGPoint(x: targetX, y: targetY)
    }, completion: nil)
  }
}

// MARK: - UIColor extension for hex colors
extension UIColor {
  convenience init(hexString: String) {
    let hex = hexString.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int = UInt64()
    Scanner(string: hex).scanHexInt64(&int)
    let a, r, g, b: UInt64
    switch hex.count {
    case 3: // RGB (12-bit)
      (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
    case 6: // RGB (24-bit)
      (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
    case 8: // ARGB (32-bit)
      (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
    default:
      (a, r, g, b) = (255, 0, 0, 0)
    }
    self.init(red: CGFloat(r) / 255, green: CGFloat(g) / 255, blue: CGFloat(b) / 255, alpha: CGFloat(a) / 255)
  }
}