<?php
namespace Src\Services;

use Cloudinary\Cloudinary;

class CloudinaryService
{
    private Cloudinary $cloudinary;

    public function __construct()
    {
        $this->cloudinary = new Cloudinary([
            'cloud' => [
                'cloud_name' => $this->env('CLOUDINARY_CLOUD'),
                'api_key'    => $this->env('CLOUDINARY_KEY'),
                'api_secret' => $this->env('CLOUDINARY_SECRET')
            ],
            'url' => [
                'secure' => true
            ]
        ]);
    }

    /**
     * Safe env reader (Railway + local)
     */
    private function env(string $key, $default = null)
    {
        $value = getenv($key);
        if ($value !== false) return $value;

        if (array_key_exists($key, $_SERVER)) {
            return $_SERVER[$key];
        }

        if (array_key_exists($key, $_ENV)) {
            return $_ENV[$key];
        }

        return $default;
    }

    /**
     * Upload any image or pdf
     */
    public function uploadFile($file, string $folder = 'solennia')
    {
        if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
            throw new \Exception("Invalid file upload");
        }

        $tmpPath = $file->getStream()->getMetadata('uri');

        $result = $this->cloudinary->uploadApi()->upload($tmpPath, [
            'folder' => $folder
        ]);

        return $result['secure_url'] ?? null;
    }

    /**
     * Upload a profile image (standard size)
     */
    public function uploadAvatar($file)
    {
        if (!$file || $file->getError() !== UPLOAD_ERR_OK) {
            throw new \Exception("Invalid avatar upload");
        }

        $tmpPath = $file->getStream()->getMetadata('uri');

        $result = $this->cloudinary->uploadApi()->upload($tmpPath, [
            'folder' => 'solennia/avatars',
            'transformation' => [
                ['width' => 400, 'height' => 400, 'crop' => 'fill']
            ]
        ]);

        return $result['secure_url'] ?? null;
    }
}