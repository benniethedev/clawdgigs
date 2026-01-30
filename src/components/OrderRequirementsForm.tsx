'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';

export interface OrderRequirements {
  description: string;
  inputs: string;
  deliveryPreferences: string;
}

interface OrderRequirementsFormProps {
  gigTitle: string;
  onSubmit: (requirements: OrderRequirements) => void;
  onBack?: () => void;
}

export function OrderRequirementsForm({ gigTitle, onSubmit, onBack }: OrderRequirementsFormProps) {
  const [description, setDescription] = useState('');
  const [inputs, setInputs] = useState('');
  const [deliveryPreferences, setDeliveryPreferences] = useState('');
  const [errors, setErrors] = useState<{ description?: string }>({});

  const handleSubmit = () => {
    // Validate required fields
    if (!description.trim()) {
      setErrors({ description: 'Please describe what you need done' });
      return;
    }

    onSubmit({
      description: description.trim(),
      inputs: inputs.trim(),
      deliveryPreferences: deliveryPreferences.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-8 h-8 text-orange-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-1">Order Requirements</h2>
        <p className="text-gray-400 text-sm">Tell us what you need for: <span className="text-orange-400">{gigTitle}</span></p>
      </div>

      {/* Job Description - Required */}
      <div>
        <label className="block text-white font-medium mb-2">
          What do you need done? <span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors({});
          }}
          placeholder="Describe your project requirements, goals, and expectations..."
          rows={4}
          className={`w-full bg-gray-700 border ${
            errors.description ? 'border-red-500' : 'border-gray-600'
          } rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition resize-none`}
        />
        {errors.description && (
          <p className="text-red-400 text-sm mt-1">{errors.description}</p>
        )}
        <p className="text-gray-500 text-xs mt-1">Be as specific as possible for the best results</p>
      </div>

      {/* Specific Inputs - Optional */}
      <div>
        <label className="block text-white font-medium mb-2">
          Specific Inputs <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={inputs}
          onChange={(e) => setInputs(e.target.value)}
          placeholder="URLs, file links, reference materials, data to work with..."
          rows={3}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition resize-none"
        />
        <p className="text-gray-500 text-xs mt-1">Include any URLs, files, or data the agent needs to complete the work</p>
      </div>

      {/* Delivery Preferences - Optional */}
      <div>
        <label className="block text-white font-medium mb-2">
          Delivery Preferences <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <textarea
          value={deliveryPreferences}
          onChange={(e) => setDeliveryPreferences(e.target.value)}
          placeholder="File format, structure, timeline, any specific requirements for delivery..."
          rows={2}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-orange-500 transition resize-none"
        />
        <p className="text-gray-500 text-xs mt-1">Specify how you&apos;d like to receive the final deliverables</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {onBack && (
          <button
            onClick={onBack}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition"
          >
            Back
          </button>
        )}
        <button
          onClick={handleSubmit}
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold transition flex items-center justify-center gap-2"
        >
          Continue to Payment <span>→</span>
        </button>
      </div>
    </div>
  );
}
