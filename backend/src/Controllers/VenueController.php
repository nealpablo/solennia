<?php
namespace Src\Controllers;

use Cloudinary\Cloudinary;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Illuminate\Database\Capsule\Manager as DB;

class VenueController
{
    private Cloudinary $cloud;
    private const MAX_FILE_SIZE = 10485760; // 10MB
    private const UPLOAD_TIMEOUT = 20; // Reduced from 60 to 20 seconds

    public function __construct()
    {
        $this->cloud = new Cloudinary([
            'cloud' => [
                'cloud_name' => getenv('CLOUDINARY_CLOUD'),
                'api_key'    => getenv('CLOUDINARY_KEY'),
                'api_secret' => getenv('CLOUDINARY_SECRET')
            ],
            'url' => ['secure' => true]
        ]);
    }

    /* =========================================================
     * ✅ OPTIMIZED CREATE VENUE LISTING with validation
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

            // ✅ Start transaction
            DB::beginTransaction();

            try {
                // ✅ Upload Logo (Main Image) with validation
                $logoUrl = null;
                if (isset($files['logo']) && $files['logo']->getError() === UPLOAD_ERR_OK) {
                    // Validate file size
                    if ($files['logo']->getSize() > self::MAX_FILE_SIZE) {
                        DB::rollBack();
                        return $this->json($response, false, "Logo file too large (max 10MB)", 400);
                    }

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
                                    'quality' => 'auto:eco',
                                    'fetch_format' => 'auto'
                                ]
                            ],
                            'timeout' => self::UPLOAD_TIMEOUT
                        ]);
                        $logoUrl = $upload['secure_url'];
                    } catch (\Exception $e) {
                        error_log("LOGO_UPLOAD_ERROR: " . $e->getMessage());
                        DB::rollBack();
                        return $this->json($response, false, "Failed to upload logo image: " . $e->getMessage(), 500);
                    }
                }

                // ✅ Upload Gallery Images with validation
                $galleryUrls = [];
                $galleryKeys = ['gallery_1', 'gallery_2', 'gallery_3'];
                
                foreach ($galleryKeys as $key) {
                    if (isset($files[$key]) && $files[$key]->getError() === UPLOAD_ERR_OK) {
                        // Validate file size
                        if ($files[$key]->getSize() > self::MAX_FILE_SIZE) {
                            error_log("GALLERY_FILE_TOO_LARGE: {$key}");
                            continue; // Skip but don't fail
                        }

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
                                        'quality' => 'auto:eco',
                                        'fetch_format' => 'auto'
                                    ]
                                ],
                                'timeout' => self::UPLOAD_TIMEOUT
                            ]);
                            $galleryUrls[] = $upload['secure_url'];
                        } catch (\Exception $e) {
                            error_log("GALLERY_UPLOAD_ERROR_{$key}: " . $e->getMessage());
                        }
                    }
                }

                // ✅ Build insert data
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
                    'created_at' => DB::raw('NOW()')
                ];

                // ✅ Cached column check (only once)
                static $tableColumns = null;
                static $columnNames = null;
                
                if ($tableColumns === null) {
                    $tableColumns = DB::select("SHOW COLUMNS FROM venue_listings");
                    $columnNames = array_column($tableColumns, 'Field');
                }
                
                // Add logo to the correct column
                if ($logoUrl) {
                    $possibleImageColumns = [
                        'portfolio_image', 'portfolio', 'hero_image', 
                        'HeroImageUrl', 'main_image', 'image_url', 'venue_image'
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
                    if (in_array('gallery', $columnNames)) {
                        $insertData['gallery'] = json_encode($galleryUrls);
                    } elseif (in_array('gallery_images', $columnNames)) {
                        $insertData['gallery_images'] = json_encode($galleryUrls);
                    }
                }

                // ✅ Insert listing
                $listingId = DB::table('venue_listings')->insertGetId($insertData);

                DB::commit();

                error_log("VENUE_LISTING_CREATED: ID={$listingId}, Logo={$logoUrl}, Gallery=" . count($galleryUrls));

                return $this->json($response, true, "Listing created successfully!", 201, [
                    'listing_id' => $listingId,
                    'logo' => $logoUrl,
                    'gallery' => $galleryUrls,
                    'gallery_count' => count($galleryUrls)
                ]);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            error_log("CREATE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to create listing: " . $e->getMessage(), 500);
        }
    }

    /* =========================================================
     * ✅ OPTIMIZED GET MY VENUE LISTINGS with pagination
     * ========================================================= */
    public function getMyListings(Request $request, Response $response)
    {
        try {
            $u = $request->getAttribute('user');
            if (!$u || !isset($u->mysql_id)) {
                return $this->json($response, false, "Unauthorized", 401);
            }
            $userId = $u->mysql_id;

            // ✅ Add pagination support
            $params = $request->getQueryParams();
            $page = max(1, (int)($params['page'] ?? 1));
            $perPage = min(50, max(1, (int)($params['per_page'] ?? 20)));
            $offset = ($page - 1) * $perPage;

            // ✅ Optimized query with pagination
            $listings = DB::table('venue_listings')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->offset($offset) 
                ->limit($perPage)
                ->get();

            // Get total count for pagination
            $total = DB::table('venue_listings')
                ->where('user_id', $userId)
                ->count();

            // ✅ Determine which image column exists
            static $imageColumn = null;
            if ($imageColumn === null && !$listings->isEmpty()) {
                $first = $listings->first();
                $imageColumn = $first->portfolio_image ?? 
                              $first->portfolio ?? 
                              $first->hero_image ?? 
                              $first->HeroImageUrl ?? 
                              $first->main_image ?? 
                              null;
            }

            $formatted = $listings->map(function($listing) {
                return [
                    'id' => $listing->id,
                    'venue_name' => $listing->venue_name,
                    'venue_subcategory' => $listing->venue_subcategory,
                    'venue_capacity' => $listing->venue_capacity,
                    'venue_amenities' => $listing->venue_amenities,
                    'venue_operating_hours' => $listing->venue_operating_hours,
                    'venue_parking' => $listing->venue_parking,
                    'address' => $listing->address,
                    'description' => $listing->description,
                    'pricing' => $listing->pricing,
                    'contact_email' => $listing->contact_email,
                    'status' => $listing->status,
                    'main_image' => $listing->portfolio_image ?? 
                                   $listing->portfolio ?? 
                                   $listing->hero_image ?? 
                                   $listing->HeroImageUrl ?? 
                                   $listing->main_image ?? 
                                   null,
                    'gallery' => json_decode($listing->gallery ?? $listing->gallery_images ?? '[]', true),
                    'created_at' => $listing->created_at
                ];
            })->toArray();

            return $this->json($response, true, "Listings retrieved", 200, [
                'listings' => $formatted,
                'pagination' => [
                    'page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'total_pages' => ceil($total / $perPage)
                ]
            ]);

        } catch (\Exception $e) {
            error_log("GET_MY_LISTINGS_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to get listings", 500);
        }
    }

    /* =========================================================
     * ✅ OPTIMIZED UPDATE VENUE LISTING with validation
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

            // ✅ Start transaction
            DB::beginTransaction();

            try {
                // Verify ownership
                $listing = DB::table('venue_listings')
                    ->where('id', $listingId)
                    ->where('user_id', $userId)
                    ->first();

                if (!$listing) {
                    DB::rollBack();
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

                // ✅ Upload new logo if provided with validation
                if (isset($files['logo']) && $files['logo']->getError() === UPLOAD_ERR_OK) {
                    // Validate file size
                    if ($files['logo']->getSize() > self::MAX_FILE_SIZE) {
                        DB::rollBack();
                        return $this->json($response, false, "Logo file too large (max 10MB)", 400);
                    }

                    try {
                        $tmp = $files['logo']->getStream()->getMetadata('uri');
                        $upload = $this->cloud->uploadApi()->upload($tmp, [
                            'folder' => "solennia/venues/logo/{$userId}",
                            'resource_type' => 'image',
                            'transformation' => [
                                ['width' => 1200, 'height' => 800, 'crop' => 'limit', 'quality' => 'auto:eco', 'fetch_format' => 'auto']
                            ],
                            'timeout' => self::UPLOAD_TIMEOUT
                        ]);
                        
                        // Find which column to update
                        static $tableColumns = null;
                        static $columnNames = null;
                        
                        if ($tableColumns === null) {
                            $tableColumns = DB::select("SHOW COLUMNS FROM venue_listings");
                            $columnNames = array_column($tableColumns, 'Field');
                        }
                        
                        $possibleImageColumns = ['portfolio_image', 'portfolio', 'hero_image', 'HeroImageUrl', 'main_image'];
                        foreach ($possibleImageColumns as $col) {
                            if (in_array($col, $columnNames)) {
                                $updateData[$col] = $upload['secure_url'];
                                break;
                            }
                        }
                    } catch (\Exception $e) {
                        error_log("LOGO_UPDATE_ERROR: " . $e->getMessage());
                        DB::rollBack();
                        return $this->json($response, false, "Failed to upload logo: " . $e->getMessage(), 500);
                    }
                }

                // ✅ Upload new gallery images if provided with validation
                $existingGallery = [];
                $galleryField = $listing->gallery ?? $listing->gallery_images ?? null;
                if ($galleryField) {
                    $existingGallery = json_decode($galleryField, true) ?? [];
                }
                
                $newGalleryUrls = [];
                $galleryKeys = ['gallery_1', 'gallery_2', 'gallery_3'];
                
                foreach ($galleryKeys as $idx => $key) {
                    if (isset($files[$key]) && $files[$key]->getError() === UPLOAD_ERR_OK) {
                        // Validate file size
                        if ($files[$key]->getSize() > self::MAX_FILE_SIZE) {
                            error_log("GALLERY_FILE_TOO_LARGE: {$key}");
                            if (isset($existingGallery[$idx])) {
                                $newGalleryUrls[$idx] = $existingGallery[$idx];
                            }
                            continue;
                        }

                        try {
                            $tmp = $files[$key]->getStream()->getMetadata('uri');
                            $upload = $this->cloud->uploadApi()->upload($tmp, [
                                'folder' => "solennia/venues/gallery/{$userId}",
                                'resource_type' => 'image',
                                'transformation' => [
                                    ['width' => 800, 'height' => 600, 'crop' => 'limit', 'quality' => 'auto:eco', 'fetch_format' => 'auto']
                                ],
                                'timeout' => self::UPLOAD_TIMEOUT
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
                    static $tableColumns = null;
                    static $columnNames = null;
                    
                    if ($tableColumns === null) {
                        $tableColumns = DB::select("SHOW COLUMNS FROM venue_listings");
                        $columnNames = array_column($tableColumns, 'Field');
                    }
                    
                    if (in_array('gallery', $columnNames)) {
                        $updateData['gallery'] = json_encode(array_values($newGalleryUrls));
                    } elseif (in_array('gallery_images', $columnNames)) {
                        $updateData['gallery_images'] = json_encode(array_values($newGalleryUrls));
                    }
                }

                if (empty($updateData)) {
                    DB::rollBack();
                    return $this->json($response, false, "No data to update", 400);
                }

                DB::table('venue_listings')
                    ->where('id', $listingId)
                    ->update($updateData);

                DB::commit();

                return $this->json($response, true, "Listing updated successfully!", 200);

            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

        } catch (\Exception $e) {
            error_log("UPDATE_LISTING_ERROR: " . $e->getMessage());
            return $this->json($response, false, "Failed to update listing: " . $e->getMessage(), 500);
        }
    }

    /* =========================================================
     * ✅ OPTIMIZED DELETE VENUE LISTING
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