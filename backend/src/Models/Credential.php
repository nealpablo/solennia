<?php
namespace Src\Models;

use Illuminate\Database\Eloquent\Model;

class Credential extends Model
{
    // Matches your actual table name
    protected $table = 'credential';

    public $timestamps = false;

    protected $fillable = [
        'first_name',
        'last_name',
        'email',
        'username',
        'password',
    ];

    protected $hidden = ['password'];
}
