import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    speechSpeed: number;
    voiceTone: string;
    choiceTimeout: number;
    fadeOut: boolean;
  };
  onSettingsChange: (settings: any) => void;
}

export default function SettingsModal({ 
  isOpen, 
  onClose, 
  settings, 
  onSettingsChange 
}: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState(settings);

  const handleSave = () => {
    onSettingsChange(localSettings);
    onClose();
  };

  const updateSetting = (key: string, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-light">Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Voice Settings */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium">Voice Settings</h4>
            
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">Speech Speed</Label>
              <Slider
                value={[localSettings.speechSpeed]}
                onValueChange={(value) => updateSetting('speechSpeed', value[0])}
                min={0.5}
                max={1.5}
                step={0.1}
                className="cursor-pointer"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Slower</span>
                <span>Normal</span>
                <span>Faster</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">Voice Tone</Label>
              <Select 
                value={localSettings.voiceTone} 
                onValueChange={(value) => updateSetting('voiceTone', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whisper">Whisper</SelectItem>
                  <SelectItem value="gentle">Gentle</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="warm">Warm</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Sleep Timer */}
          <div className="space-y-4">
            <h4 className="text-lg font-medium">Sleep Timer</h4>
            
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">Auto-choice timeout</Label>
              <Select 
                value={localSettings.choiceTimeout.toString()} 
                onValueChange={(value) => updateSetting('choiceTimeout', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="45">45 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="90">1.5 minutes</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center space-x-3">
              <Checkbox
                id="fade-out"
                checked={localSettings.fadeOut}
                onCheckedChange={(checked) => updateSetting('fadeOut', checked)}
              />
              <Label htmlFor="fade-out" className="text-sm text-muted-foreground">
                Gradually fade audio when no response
              </Label>
            </div>
          </div>
          
          {/* Save Button */}
          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
