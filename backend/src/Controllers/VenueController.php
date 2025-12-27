<?php
namespace Src\Controllers;

use Cloudinary\Cloudinary;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class VenueController
{
    private Cloudinary $cloud;

    public function __construct()
    {
        $this->cloud = new Cloudinary([
            'cloud' => [
                'cloud_name' => $_ENV['CLOUDINARY_CLOUD'],
                'api_key'    => $_ENV['CLOUDINARY_KEY'],
                'api_secret' => $_ENV['CLOUDINARY_SECRET']
            ],
            'url' => ['secure' => true]
        ]);
    }

    /* =========================================================
     * ✅ CREATE VENUE LISTING - ADAPTIVE VERSION
     * ========================================================= */
    public function createListing(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }
            $userId = $u->mysql_id;

            $data = (array) $request->getParsedBody();
            $files = $request->getUploadedFiles();

            // Validate required fields
            if (empty($data['venue_name']) || empty($data['address']) || empty($data['pricing'])) {
                return $this->json($response, false, "Missing required fields", 422);
            }

            // ✅ Upload Logo (Main Image)
            $logoUrl = null;
            if (isset($files['logo']) && $files['logo']->getError() === UPLOAD_ERR_OK) {
                try {
                    $tmp = $files['logo']->getStream()->getMetadata('uri');
                    $upload = $this->cloud->uploadApi()->upload($tmp, [
                        'folder' => "solennia/venues/logo/{$userId}",
                        'resource_type' => 'image',
                        'public_id' => 'logo_' . time(),
                        'transformation' => [
                            [
                                'width' => 1200,
                                'height' => 800,
                                'crop' => 'limit',
                                'quality' => 'auto:good',
                                'fetch_format' => 'auto'
                            ]
                        ],
                        'timeout' => 60
                    ]);
                    $logoUrl = $upload['secure_url'];
                } catch (\Exception $e) {
                    error_log("LOGO_UPLOAD_ERROR: " . $e->getMessage());
                    return $this->json($response, false, "Failed to upload logo image", 500);
                }
            }

            // ✅ Upload Gallery Images (up to 3 individual images)
            $galleryUrls = [];
            $galleryKeys = ['gallery_1', 'gallery_2', 'gallery_3'];
            
            foreach ($galleryKeys as $key) {
                if (isset($files[$key]) && $files[$key]->getError() === UPLOAD_ERR_OK) {
                    try {
                        $tmp = $files[$key]->getStream()->getMetadata('uri');
                        $upload = $this->cloud->uploadApi()->upload($tmp, [
                            'folder' => "solennia/venues/gallery/{$userId}",
                            'resource_type' => 'image',
                            'public_id' => $key . '_' . time() . '_' . bin2hex(random_bytes(4)),
                            'transformation' => [
                                [
                                    'width' => 800,
                                    'height' => 600,
                                    'crop' => 'limit',
                                    'quality' => 'auto:good',
                                    'fetch_format' => 'auto'
                                ]
                            ],
                            'timeout' => 60
                        ]);
                        $galleryUrls[] = $upload['secure_url'];
                    } catch (\Exception $e) {
                        error_log("GALLERY_UPLOAD_ERROR_{$key}: " . $e->getMessage());
                    }
                }
            }

            // ✅ ADAPTIVE: Build insert data based on what columns might exist
            $insertData = [
                'user_id' => $userId,
                'venue_name' => $data['venue_name'],
                'venue_subcategory' => $data['venue_subcategory'] ?? null,
                'venue_capacity' => $data['venue_capacity'] ?? null,
                'venue_amenities' => $data['venue_amenities'] ?? null,
                'venue_operating_hours' => $data['venue_operating_hours'] ?? null,
                'venue_parking' => $data['venue_parking'] ?? null,
                'address' => $data['address'],
                'description' => $data['description'] ?? null,
                'pricing' => $data['pricing'],
                'contact_email' => $data['contact_email'] ?? null,
                'status' => 'Active',
                'created_at' => date('Y-m-d H:i:s')
            ];

            // Try different possible column names for the main image
            if ($logoUrl) {
                // Check which columns exist by trying to get column info
                $tableColumns = DB::select("SHOW COLUMNS FROM venue_listings");
                $columnNames = array_column($tableColumns, 'Field');
                
                // Try common image column names
                $possibleImageColumns = [
                    'portfolio_image',
                    'portfolio',
                    'hero_image',
                    'HeroImageUrl',
                    'main_image',
                    'image_url',
                    'venue_image'
                ];
                
                foreach ($possibleImageColumns as $col) {
                    if (in_array($col, $columnNames)) {
                        $insertData[$col] = $logoUrl;
                        break;
                    }
                }
            }

            // Add gallery if column exists
            if (!empty($galleryUrls)) {
                $tableColumns = $tableColumns ?? DB::select("SHOW COLUMNS FROM venue_listings");
                $columnNames = $columnNames ?? array_column($tableColumns, 'Field');
                
                if (in_array('gallery', $columnNames)) {
                    $insertData['gallery'] = json_encode($galleryUrls);
                } elseif (in_array('gallery_images', $columnNames)) {
                    $insertData['gallery_images'] = json_encode($galleryUrls);
                }
            }

            // ✅ Insert listing
            $listingId = DB::table('venue_listings')->insertGetId($insertData);

            error_log("VENUE_LISTING_CREATED: ID={$listingId}, Logo={$logoUrl}, Gallery=" . count($galleryUrls));

            return $this->json($response, true, "Listing created successfully!", 201, [
                'listing_id' => $listingId,
                'logo' => $logoUrl,
                'gallery' => $galleryUrls,
                'gallery_count' => count($galleryUrls)
            ]);

        } catch (\Exception $e) {
            error_log("CREATE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to create listing: " . $e->getMessage(), 500);
        }
    }

    /* =========================================================
     * ✅ GET MY VENUE LISTINGS
     * ========================================================= */
    public function getMyListings(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }
            $userId = $u->mysql_id;

            $listings = DB::table('venue_listings')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->get();

            // ✅ Parse gallery JSON and normalize image field names
            $listings = array_map(function($listing) {
                $listing = (array) $listing;
                
                // Parse gallery
                $galleryField = $listing['gallery'] ?? $listing['gallery_images'] ?? null;
                if ($galleryField) {
                    try {
                        $listing['gallery'] = json_decode($galleryField, true);
                    } catch (\Exception $e) {
                        $listing['gallery'] = [];
                    }
                } else {
                    $listing['gallery'] = [];
                }
                
                // Normalize main image field name
                if (!isset($listing['portfolio'])) {
                    $listing['portfolio'] = $listing['portfolio_image'] 
                        ?? $listing['hero_image'] 
                        ?? $listing['HeroImageUrl'] 
                        ?? $listing['main_image'] 
                        ?? $listing['image_url'] 
                        ?? $listing['venue_image'] 
                        ?? null;
                }
                
                return $listing;
            }, $listings->toArray());

            return $this->json($response, true, "Listings retrieved", 200, [
                'listings' => $listings
            ]);

        } catch (\Exception $e) {
            error_log("GET_MY_LISTINGS_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to get listings", 500);
        }
    }

    /* =========================================================
     * ✅ UPDATE VENUE LISTING - ADAPTIVE VERSION
     * ========================================================= */
    public function updateListing(Request $request, Response $response, $args)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }
            $userId = $u->mysql_id;
            $listingId = (int) $args['id'];

            // Verify ownership
            $listing = DB::table('venue_listings')
                ->where('id', $listingId)
                ->where('user_id', $userId)
                ->first();

            if (!$listing) {
                return $this->json($response, false, "Listing not found or access denied", 404);
            }

            $data = (array) $request->getParsedBody();
            $files = $request->getUploadedFiles();

            $updateData = [];

            // Text fields
            $textFields = ['venue_name', 'venue_subcategory', 'venue_capacity', 
                          'venue_amenities', 'venue_operating_hours', 'venue_parking',
                          'description', 'pricing', 'address', 'contact_email'];
            
            foreach ($textFields as $field) {
                if (isset($data[$field])) {
                    $updateData[$field] = $data[$field];
                }
            }

            // ✅ Upload new logo if provided
            if (isset($files['logo']) && $files['logo']->getError() === UPLOAD_ERR_OK) {
                try {
                    $tmp = $files['logo']->getStream()->getMetadata('uri');
                    $upload = $this->cloud->uploadApi()->upload($tmp, [
                        'folder' => "solennia/venues/logo/{$userId}",
                        'resource_type' => 'image',
                        'transformation' => [
                            ['width' => 1200, 'height' => 800, 'crop' => 'limit', 'quality' => 'auto:good']
                        ],
                        'timeout' => 60
                    ]);
                    
                    // Find which column to update
                    $tableColumns = DB::select("SHOW COLUMNS FROM venue_listings");
                    $columnNames = array_column($tableColumns, 'Field');
                    
                    $possibleImageColumns = ['portfolio_image', 'portfolio', 'hero_image', 'HeroImageUrl', 'main_image'];
                    foreach ($possibleImageColumns as $col) {
                        if (in_array($col, $columnNames)) {
                            $updateData[$col] = $upload['secure_url'];
                        }
                    }
                } catch (\Exception $e) {
                    error_log("LOGO_UPDATE_ERROR: " . $e->getMessage());
                }
            }

            // ✅ Upload new gallery images if provided
            $existingGallery = [];
            $galleryField = $listing->gallery ?? $listing->gallery_images ?? null;
            if ($galleryField) {
                $existingGallery = json_decode($galleryField, true) ?? [];
            }
            
            $newGalleryUrls = [];
            $galleryKeys = ['gallery_1', 'gallery_2', 'gallery_3'];
            
            foreach ($galleryKeys as $idx => $key) {
                if (isset($files[$key]) && $files[$key]->getError() === UPLOAD_ERR_OK) {
                    try {
                        $tmp = $files[$key]->getStream()->getMetadata('uri');
                        $upload = $this->cloud->uploadApi()->upload($tmp, [
                            'folder' => "solennia/venues/gallery/{$userId}",
                            'resource_type' => 'image',
                            'transformation' => [
                                ['width' => 800, 'height' => 600, 'crop' => 'limit', 'quality' => 'auto:good']
                            ],
                            'timeout' => 60
                        ]);
                        $newGalleryUrls[$idx] = $upload['secure_url'];
                    } catch (\Exception $e) {
                        error_log("GALLERY_UPDATE_ERROR_{$key}: " . $e->getMessage());
                        if (isset($existingGallery[$idx])) {
                            $newGalleryUrls[$idx] = $existingGallery[$idx];
                        }
                    }
                } else {
                    if (isset($existingGallery[$idx])) {
                        $newGalleryUrls[$idx] = $existingGallery[$idx];
                    }
                }
            }

            if (!empty($newGalleryUrls)) {
                $tableColumns = $tableColumns ?? DB::select("SHOW COLUMNS FROM venue_listings");
                $columnNames = $columnNames ?? array_column($tableColumns, 'Field');
                
                if (in_array('gallery', $columnNames)) {
                    $updateData['gallery'] = json_encode(array_values($newGalleryUrls));
                } elseif (in_array('gallery_images', $columnNames)) {
                    $updateData['gallery_images'] = json_encode(array_values($newGalleryUrls));
                }
            }

            if (empty($updateData)) {
                return $this->json($response, false, "No data to update", 400);
            }

            DB::table('venue_listings')
                ->where('id', $listingId)
                ->update($updateData);

            return $this->json($response, true, "Listing updated successfully!", 200);

        } catch (\Exception $e) {
            error_log("UPDATE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to update listing", 500);
        }
    }

    /* =========================================================
     * ✅ DELETE VENUE LISTING
     * ========================================================= */
    public function deleteListing(Request $request, Response $response, $args)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }
            $userId = $u->mysql_id;
            $listingId = (int) $args['id'];

            $deleted = DB::table('venue_listings')
                ->where('id', $listingId)
                ->where('user_id', $userId)
                ->delete();

            if (!$deleted) {
                return $this->json($response, false, "Listing not found", 404);
            }

            return $this->json($response, true, "Listing deleted successfully!", 200);

        } catch (\Exception $e) {
            error_log("DELETE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to delete listing", 500);
        }
    }

    /* =========================================================
     * HELPER
     * ========================================================= */
    private function json(Response $res, bool $success, string $message, int $status = 200, array $extra = [])
    {
        $payload = array_merge([
            'success' => $success,
            $success ? 'message' : 'error' => $message,
        ], $extra);

        $res->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE));
        return $res->withHeader('Content-Type', 'application/json')
                   ->withStatus($status);
    }
}

