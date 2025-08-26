#import "React/RCTBridgeModule.h"
#import "React/RCTEventEmitter.h"

@interface RCT_EXTERN_MODULE(FloatingWidgetManager, NSObject)

RCT_EXTERN_METHOD(showFloatingWidget:(NSDictionary *)options)
RCT_EXTERN_METHOD(hideFloatingWidget)
RCT_EXTERN_METHOD(updatePosition:(NSDictionary *)position)

@end