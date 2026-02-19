import { useState, useEffect } from 'react';
import { X, Palette, Copy } from 'lucide-react';
import { CustomTheme, CustomThemeColors } from '../types';

interface CustomThemeEditorModalProps {
  isOpen: boolean;
  editingTheme?: CustomTheme | null;
  onSave: (theme: CustomTheme) => void;
  onCancel: () => void;
}

const PRESET_STARTERS: Record<string, { label: string; colors: CustomThemeColors }> = {
  dark: {
    label: 'Dark',
    colors: {
      bgColor: '#1a1a2e',
      sidebarColor: '#16213e',
      cardColor: '#0f3460',
      textColor: '#eaeaea',
      textMuted: '#a0a0a0',
      borderColor: '#2a2a4a',
      hoverBg: '#2a2a4a',
      inputBg: '#0f0f1a',
      accent: '#e94560',
      accentHover: '#d63350',
    },
  },
  light: {
    label: 'Light',
    colors: {
      bgColor: '#e8eaed',
      sidebarColor: '#f0f2f5',
      cardColor: '#f5f6f8',
      textColor: '#2a2a2a',
      textMuted: '#5a5f66',
      borderColor: '#d0d4d8',
      hoverBg: '#e0e2e5',
      inputBg: '#f8f9fa',
      accent: '#c93850',
      accentHover: '#b52d45',
    },
  },
  ocean: {
    label: 'Ocean',
    colors: {
      bgColor: '#071e2e',
      sidebarColor: '#0a2740',
      cardColor: '#0d3358',
      textColor: '#e2eaf2',
      textMuted: '#7fa8c9',
      borderColor: '#1a4a6e',
      hoverBg: '#1a4a6e',
      inputBg: '#041524',
      accent: '#0ea5e9',
      accentHover: '#0284c7',
    },
  },
  forest: {
    label: 'Forest',
    colors: {
      bgColor: '#091a0d',
      sidebarColor: '#0c2213',
      cardColor: '#0f331c',
      textColor: '#e2f2e6',
      textMuted: '#7abf92',
      borderColor: '#1a4a2c',
      hoverBg: '#1a4a2c',
      inputBg: '#051209',
      accent: '#22c55e',
      accentHover: '#16a34a',
    },
  },
  earth: {
    label: 'Earth',
    colors: {
      bgColor: '#1a120a',
      sidebarColor: '#231810',
      cardColor: '#2e1f0d',
      textColor: '#f2ece4',
      textMuted: '#a89070',
      borderColor: '#4a3020',
      hoverBg: '#4a3020',
      inputBg: '#140e06',
      accent: '#d97706',
      accentHover: '#b45309',
    },
  },
  aurora: {
    label: 'Aurora',
    colors: {
      bgColor: '#0d0d1a',
      sidebarColor: '#130d2e',
      cardColor: '#1a1040',
      textColor: '#e8e2f8',
      textMuted: '#8b7fc4',
      borderColor: '#2e1f6e',
      hoverBg: '#2e1f6e',
      inputBg: '#08060f',
      accent: '#c026d3',
      accentHover: '#a21caf',
    },
  },
  sunset: {
    label: 'Sunset',
    colors: {
      bgColor: '#3d0800',
      sidebarColor: '#2a0500',
      cardColor: '#4d0a00',
      textColor: '#fff5f0',
      textMuted: '#ffaa88',
      borderColor: '#7a1500',
      hoverBg: '#7a1500',
      inputBg: '#220400',
      accent: '#ff1500',
      accentHover: '#dd1000',
    },
  },
  candy: {
    label: 'Candy',
    colors: {
      bgColor: '#4d0030',
      sidebarColor: '#3a0022',
      cardColor: '#600040',
      textColor: '#fff0fa',
      textMuted: '#ffaadd',
      borderColor: '#880055',
      hoverBg: '#880055',
      inputBg: '#2a0018',
      accent: '#ff0080',
      accentHover: '#dd006e',
    },
  },
  rainbow: {
    label: 'Rainbow',
    colors: {
      bgColor: '#1a0a3d',
      sidebarColor: '#120830',
      cardColor: '#230d50',
      textColor: '#fffdf0',
      textMuted: '#b090e0',
      borderColor: '#3d1880',
      hoverBg: '#3d1880',
      inputBg: '#0d051e',
      accent: '#ffdd00',
      accentHover: '#e0c000',
    },
  },
};

const COLOR_FIELDS: Array<{ key: keyof CustomThemeColors; label: string; description: string }> = [
  { key: 'bgColor', label: 'Background', description: 'Main app background' },
  { key: 'sidebarColor', label: 'Sidebar', description: 'Sidebar / secondary background' },
  { key: 'cardColor', label: 'Card / Panel', description: 'Cards and panels background' },
  { key: 'inputBg', label: 'Input Background', description: 'Input and code editor fields' },
  { key: 'textColor', label: 'Text', description: 'Primary text color' },
  { key: 'textMuted', label: 'Muted Text', description: 'Secondary / placeholder text' },
  { key: 'borderColor', label: 'Border', description: 'Borders and dividers' },
  { key: 'hoverBg', label: 'Hover Background', description: 'Hover state background' },
  { key: 'accent', label: 'Accent', description: 'Buttons and active highlights' },
  { key: 'accentHover', label: 'Accent Hover', description: 'Accent color on hover' },
];

export default function CustomThemeEditorModal({
  isOpen,
  editingTheme,
  onSave,
  onCancel,
}: CustomThemeEditorModalProps) {
  const [name, setName] = useState(editingTheme?.name ?? '');
  const [colors, setColors] = useState<CustomThemeColors>(
    editingTheme?.colors ?? PRESET_STARTERS.dark.colors
  );
  const [nameError, setNameError] = useState('');

  // Reset form state whenever the modal opens (or editingTheme changes)
  useEffect(() => {
    if (isOpen) {
      setName(editingTheme?.name ?? '');
      setColors(editingTheme?.colors ? { ...editingTheme.colors } : { ...PRESET_STARTERS.dark.colors });
      setNameError('');
    }
  }, [isOpen, editingTheme]);

  if (!isOpen) return null;

  const handleColorChange = (key: keyof CustomThemeColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  const handlePresetLoad = (preset: string) => {
    const starter = PRESET_STARTERS[preset];
    if (starter) {
      setColors({ ...starter.colors });
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Theme name is required');
      return;
    }
    setNameError('');
    const theme: CustomTheme = {
      id: editingTheme?.id ?? `custom-${Date.now()}`,
      name: trimmedName,
      colors: { ...colors },
    };
    onSave(theme);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] backdrop-blur-sm">
      <div
        className="rounded-lg shadow-2xl w-[640px] max-h-[90vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: '#1a1a2e', border: '1px solid #2d2d44' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #2d2d44' }}
        >
          <div className="flex items-center gap-2">
            <Palette size={18} className="text-[#e94560]" />
            <h2 className="text-base font-semibold text-white">
              {editingTheme ? 'Edit Custom Theme' : 'Create Custom Theme'}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-gray-400 hover:text-white transition-colors"
            style={{ ':hover': { backgroundColor: '#2d2d44' } } as React.CSSProperties}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Theme Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Theme Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError('');
              }}
              placeholder="My Custom Theme"
              className="w-full px-3 py-2 rounded text-sm outline-none transition-colors"
              style={{
                backgroundColor: '#0f0f1a',
                border: nameError ? '1px solid #e94560' : '1px solid #2d2d44',
                color: '#eaeaea',
              }}
            />
            {nameError && <p className="mt-1 text-xs text-[#e94560]">{nameError}</p>}
          </div>

          {/* Start from preset */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Copy size={13} className="inline mr-1 opacity-70" />
              Start from preset
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(PRESET_STARTERS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePresetLoad(key)}
                  className="px-3 py-1 text-xs rounded transition-colors"
                  style={{
                    backgroundColor: '#16213e',
                    border: '1px solid #2d2d44',
                    color: '#a0a0a0',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#e94560';
                    (e.currentTarget as HTMLButtonElement).style.color = '#eaeaea';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = '#2d2d44';
                    (e.currentTarget as HTMLButtonElement).style.color = '#a0a0a0';
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color preview strip */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Preview</label>
            <div className="flex rounded overflow-hidden h-8 border" style={{ borderColor: '#2d2d44' }}>
              <div className="flex-1" style={{ backgroundColor: colors.bgColor }} title="Background" />
              <div className="flex-1" style={{ backgroundColor: colors.sidebarColor }} title="Sidebar" />
              <div className="flex-1" style={{ backgroundColor: colors.cardColor }} title="Card" />
              <div className="flex-1" style={{ backgroundColor: colors.inputBg }} title="Input" />
              <div className="flex-1" style={{ backgroundColor: colors.borderColor }} title="Border" />
              <div className="flex-1" style={{ backgroundColor: colors.hoverBg }} title="Hover" />
              <div className="w-8" style={{ backgroundColor: colors.accent }} title="Accent" />
              <div className="w-8" style={{ backgroundColor: colors.accentHover }} title="Accent Hover" />
            </div>
            <div className="flex mt-1">
              <div className="flex-1 flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: colors.textColor }}
                />
                <span className="text-xs" style={{ color: '#a0a0a0' }}>Text</span>
              </div>
              <div className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full border border-white/20"
                  style={{ backgroundColor: colors.textMuted }}
                />
                <span className="text-xs" style={{ color: '#a0a0a0' }}>Muted</span>
              </div>
            </div>
          </div>

          {/* Color Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Color Palette</label>
            <div className="grid grid-cols-2 gap-3">
              {COLOR_FIELDS.map(({ key, label, description }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <input
                      type="color"
                      value={colors[key]}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                      className="w-9 h-9 rounded cursor-pointer border-0 p-0 bg-transparent"
                      style={{ outline: 'none' }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-gray-200 font-medium leading-tight">{label}</div>
                    <div className="text-xs leading-tight mt-0.5" style={{ color: '#666' }}>
                      {description}
                    </div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#e94560' }}>
                      {colors[key]}
                    </div>
                  </div>
                  <input
                    type="text"
                    value={colors[key]}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                        handleColorChange(key, val);
                      }
                    }}
                    className="ml-auto w-24 px-2 py-1 text-xs font-mono rounded outline-none"
                    style={{
                      backgroundColor: '#0f0f1a',
                      border: '1px solid #2d2d44',
                      color: '#eaeaea',
                    }}
                    maxLength={7}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-5 py-4 flex-shrink-0"
          style={{ borderTop: '1px solid #2d2d44' }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded transition-colors"
            style={{ backgroundColor: '#16213e', border: '1px solid #2d2d44', color: '#a0a0a0' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#eaeaea';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#a0a0a0';
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm rounded font-semibold text-white transition-colors"
            style={{ backgroundColor: '#e94560' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#d63350';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#e94560';
            }}
          >
            {editingTheme ? 'Save Changes' : 'Create Theme'}
          </button>
        </div>
      </div>
    </div>
  );
}
