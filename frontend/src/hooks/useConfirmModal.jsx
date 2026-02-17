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

    const confirm = ({ title, message, onConfirm, confirmText = 'OK', cancelText = 'Cancel', confirmVariant = 'primary' }) => {
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
                cancelText,
                confirmVariant
            });
            setIsOpen(true);
        });
    };

    const ConfirmModal = () => {
        if (!isOpen) return null;

        const getButtonClass = () => {
            switch (config.confirmVariant) {
                case 'danger':
                    return 'bg-red-600 hover:bg-red-700 text-white';
                case 'success':
                    return 'bg-green-600 hover:bg-green-700 text-white';
                case 'primary':
                default:
                    return 'bg-[#7a5d47] hover:bg-[#654a38] text-white';
            }
        };

        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[20000] p-4">
                <div className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
                    <div className="bg-[#7a5d47] text-white p-4">
                        <h3 className="text-lg font-bold">{config.title}</h3>
                    </div>
                    <div className="p-6">
                        <p className="text-gray-600 mb-6">{config.message}</p>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={config.onCancel}
                                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                            >
                                {config.cancelText}
                            </button>
                            <button
                                onClick={config.onConfirm}
                                className={`px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm ${getButtonClass()}`}
                            >
                                {config.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return { confirm, ConfirmModal };
}

export default useConfirmModal;
