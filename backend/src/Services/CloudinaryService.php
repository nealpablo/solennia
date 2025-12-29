<?php
namespace Src\Services;

use Src\Services\CloudinaryService;


class CloudinaryService
{
    private Cloudinary $cloudinary;

    public function __construct()
    {
        $this->cloudinary = new Cloudinary([
            'cloud' => [
                'cloud_name' => $_ENV['CLOUDINARY_CLOUD_NAME'],
                'api_key'    => $_ENV['CLOUDINARY_API_KEY'],
                'api_secret' => $_ENV['CLOUDINARY_API_SECRET'],
            ],
            'url' => [
                'secure' => true
            ]
        ]);
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
