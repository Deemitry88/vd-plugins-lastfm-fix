import { React } from "@vendetta/metro/common";
import { Codeblock, Forms } from "@vendetta/ui/components";
import { ScrollView, Text } from "react-native";
import { useEffect } from "react";
import {
    useDebugInfo,
    logComponentMount,
    logComponentError,
} from "../../utils/debug";

const { FormText } = Forms;

export default React.memo(function Debug() {
    // Log component mount
    useEffect(() => {
        logComponentMount("Debug");
    }, []);

    try {
        const debugInfo = useDebugInfo();

        // Safety check for debugInfo
        if (!debugInfo) {
            logComponentError("Debug", "useDebugInfo returned null or undefined");
            return (
                <ScrollView>
                    <FormText style={{ margin: 12 }}>
            No debug information available
                    </FormText>
                </ScrollView>
            );
        }

        return (
            <ScrollView>
                <Codeblock selectable style={{ margin: 12 }}>
                    {debugInfo}
                </Codeblock>
            </ScrollView>
        );
    } catch (error) {
        logComponentError("Debug", error);
        console.error("Debug component error:", error);
        return (
            <ScrollView>
                <FormText style={{ margin: 12, color: "#FF0000" }}>
          Error loading debug information: {String(error)}
                </FormText>
            </ScrollView>
        );
    }
});
