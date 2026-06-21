//
//  HideAccessoryBar.swift
//  App
//
//  Created by Priya Shah on 18/06/2026.
//

import UIKit

extension UIView {
    private static var _overrideApplied = false
    
    static func hideWKFormAccessoryBar() {
        guard !_overrideApplied else { return }
        _overrideApplied = true
        
        guard let target = NSClassFromString("WKContentView"),
              let original = class_getInstanceMethod(target, #selector(getter: UIResponder.inputAccessoryView)) else {
            return
        }
        
        let block: @convention(block) (AnyObject) -> UIView? = { _ in nil }
        let replacement = imp_implementationWithBlock(block)
        method_setImplementation(original, replacement)
    }
}
