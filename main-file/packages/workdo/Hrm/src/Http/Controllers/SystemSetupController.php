<?php

namespace Workdo\Hrm\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;

class SystemSetupController extends Controller
{
    public function index(): RedirectResponse
    {
        return redirect()->route('hrm.branches.index');
    }
}
