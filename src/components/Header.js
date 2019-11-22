import React from 'react';

import _ from 'lodash';

import Default_sample from '../files/Default_sample.pdf';
import STEM_Sample from '../files/STEM_Sample.pdf';
import Det_is_Berlin from '../files/Det_is_Berlin.pdf';
import Book_catalog from '../files/Book_catalog.pdf';
import PDFUA_Reference from '../files/PDFUA-Reference-03_(Danish_Association-event).pdf';
import Nutshell from '../files/Nutshell.pdf';


let availableSamples = [
    {
        title: 'Default sample',
        file: Default_sample
    },
    {
        title: 'STEM Sample',
        file: STEM_Sample
    },
    {
        title: 'Det is Berlin',
        file: Det_is_Berlin
    },
    {
        title: 'Book catalog',
        file: Book_catalog
    },
    {
        title: 'PDF/UA Reference',
        file: PDFUA_Reference
    },
    {
        title: 'Nutshell',
        file: Nutshell
    }
];

let selectedFileIndex = 0;

function Header(props) {
    let uploadInputRef;

    function setUploadInputRef(node) {
        uploadInputRef = node;
    }

    function onUploadPdfClick() {
        selectedFileIndex = null;
        uploadInputRef.click();
    }

    function uploadTestPdf(sample) {
        return () => {
            selectedFileIndex = _.findIndex(availableSamples, sample);
            props.onUploadSctrictFile(sample.file);
        };
    }

    function renderSampleButtons() {
        return _.map(availableSamples, (sample, index) => (
            <button onClick={uploadTestPdf(sample)} className="app-btn"
                    disabled={index === selectedFileIndex || props.loading}>
                {sample.title}
            </button>
        ));
    }

    return (
        <header className="App-header">
            <section className="" app-btn-pane>
                {renderSampleButtons()}
                <button onClick={onUploadPdfClick} className="app-btn" disabled={props.loading}>
                    Upload other pdf
                </button>
                <input type='file' onChange={props.onUploadFile} ref={setUploadInputRef} style={{'display': 'none'}}/>
            </section>
            <div className="pdf-loading">
                {props.loading ? 'Loading pdf...' : ''}
            </div>
        </header>
    );
}

export default Header;
