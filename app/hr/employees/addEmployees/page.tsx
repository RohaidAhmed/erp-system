import React from 'react'

type Props = {}

function page({ }: Props) {
    return (
        <div className='flex flex-col'>
            <div className='grid grid-cols-2'>
                <p className=''>Employee ID: </p>
                <input type="text" className='border' />
            </div>
            <div className='grid grid-cols-2'>
                <p>Employee Name: </p>
                <input type="text" className='border'/>
            </div>
            <div className='grid grid-cols-2'>
                <p>Email: </p>
                <input type="text" className='border'/>
            </div>
            <div className='grid grid-cols-2'>
                <p>Department: </p>
                <input type="text" className='border'/>
            </div>
            <div className='grid grid-cols-2'>
                <p>Position: </p>
                <input type="text" className='border'/>
            </div>
            <div className='grid grid-cols-2'>
                <p>Salary: </p>
                <input type="text" className='border'/>
            </div>
            <div className='grid grid-cols-2'>
                <p>Hiring Date: </p>
                <input type="text" className='border'/>
            </div>
        </div>
    )
}

export default page