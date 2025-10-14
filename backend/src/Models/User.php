<?php
namespace Src\Models;

use Illuminate\Database\Eloquent\Model;

class User extends Model
{
    protected $table = 'users';
    public $timestamps = true; // uses created_at, updated_at

    protected $fillable = [
        'first_name',
        'last_name',
        'display_name',
        'phone',
        'role',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Relationships
    public function credential()
    {
        return $this->hasOne(Credential::class, 'user_id');
    }
}
