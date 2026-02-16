import { useState } from 'react';

/**
 * Custom Confirmation Modal Component
 * Replaces browser's native confirm() dialog with styled modal
 */
export function useConfirmModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [config, setConfig] = useState({
        title: '',
        message: '',
        onConfirm: null,
        confirmText: 'OK',
        cancelText: 'Cancel'
    });

    const confirm = ({ title, message, onConfirm, confirmText = 'OK', cancelText = 'Cancel' }) => {
        return new Promise((resolve) => {
            setConfig({
                title,
                message,
                onConfirm: () => {
                    setIsOpen(false);
                    if (onConfirm) onConfirm();
                    resolve(true);
                },
                onCancel: () => {
                    setIsOpen(false);
                    resolve(false);
                },
                confirmText,
                cancelText
            });
            setIsOpen(true);
        });
    };

    const ConfirmModal = () => {
        if (!isOpen) return null;

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
                <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">{config.title}</h3>
                    <p className="text-gray-600 mb-6">{config.message}</p>
                    <div className="flex gap-3">
                        <button
                            onClick={config.onCancel}
                            className="flex-1 px-6 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                        >
                            {config.cancelText}
                        </button>
                        <button
                            onClick={config.onConfirm}
                            className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                        >
                            {config.confirmText}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return { confirm, ConfirmModal };
}

export default useConfirmModal;
